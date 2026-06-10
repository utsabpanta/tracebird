import { compareNano, durationMs } from './time.js';
import { estimateCost, type PriceTable } from './cost.js';
import { normalizeSpan } from './adapters/index.js';
import {
  agentName,
  classifyKind,
  extractMessages,
  extractToolIo,
  extractUsage,
  operationName,
  provider,
  requestModel,
  toolName,
} from './genai.js';
import {
  SCHEMA_VERSION,
  StatusCode,
  type AgentNode,
  type BaseNode,
  type LlmCall,
  type Run,
  type RunNode,
  type Span,
  type StepNode,
  type TokenUsage,
  type ToolCall,
  type TraceNode,
} from './types.js';

export interface BuildOptions {
  /** Override the cost price table (USD per 1M tokens). */
  prices?: PriceTable;
}

function baseNode(span: Span, children: TraceNode[]): Omit<BaseNode, 'kind'> {
  return {
    id: span.spanId,
    name: span.name,
    startTimeUnixNano: span.startTimeUnixNano,
    endTimeUnixNano: span.endTimeUnixNano,
    durationMs: durationMs(span.startTimeUnixNano, span.endTimeUnixNano),
    status: span.status,
    attributes: span.attributes,
    children,
  };
}

function isErrorResult(result: unknown, span: Span): boolean {
  if (span.status.code === StatusCode.Error) return true;
  if (span.attributes['error.type'] != null) return true;
  return Boolean(result && typeof result === 'object' && 'error' in (result as object));
}

function buildNode(span: Span, childSpans: Map<string, Span[]>, options: BuildOptions): TraceNode {
  const kids = (childSpans.get(span.spanId) ?? [])
    .slice()
    .sort((a, b) => compareNano(a.startTimeUnixNano, b.startTimeUnixNano))
    .map((child) => buildNode(child, childSpans, options));

  const base = baseNode(span, kids);
  const kind = classifyKind(span);

  switch (kind) {
    case 'llm': {
      const model = requestModel(span);
      const usage = extractUsage(span);
      const prompt = extractMessages(span, 'prompt');
      const completion = extractMessages(span, 'completion');
      const node: LlmCall = {
        ...base,
        kind: 'llm',
        usage,
        costUsd: estimateCost(model, usage, options.prices),
      };
      if (model) node.model = model;
      const prov = provider(span);
      if (prov) node.provider = prov;
      if (prompt) node.prompt = prompt;
      if (completion) node.completion = completion;
      return node;
    }
    case 'tool': {
      const io = extractToolIo(span);
      const node: ToolCall = {
        ...base,
        kind: 'tool',
        isError: isErrorResult(io.result, span),
      };
      const name = toolName(span);
      if (name) node.toolName = name;
      if (io.arguments !== undefined) node.arguments = io.arguments;
      if (io.result !== undefined) node.result = io.result;
      return node;
    }
    case 'agent': {
      const node: AgentNode = { ...base, kind: 'agent' };
      const name = agentName(span);
      if (name) node.agentName = name;
      return node;
    }
    default: {
      const node: StepNode = { ...base, kind: 'step' };
      const op = operationName(span);
      if (op) node.operation = op;
      return node;
    }
  }
}

function flatten(nodes: TraceNode[]): TraceNode[] {
  const out: TraceNode[] = [];
  const walk = (list: TraceNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function minNano(values: string[]): string {
  return values.reduce((min, v) => (compareNano(v, min) < 0 ? v : min), values[0] ?? '0');
}

function maxNano(values: string[]): string {
  return values.reduce((max, v) => (compareNano(v, max) > 0 ? v : max), values[0] ?? '0');
}

function truncate(text: string, max = 100): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function deriveSummary(all: TraceNode[], service: string | undefined): string {
  const agent = all.find((n): n is AgentNode => n.kind === 'agent' && Boolean(n.agentName));
  let firstUser: string | undefined;
  for (const node of all) {
    if (node.kind === 'llm' && node.prompt) {
      const userMsg = node.prompt.find((m) => m.role === 'user' && m.content.trim());
      if (userMsg) {
        firstUser = userMsg.content;
        break;
      }
    }
  }
  if (agent?.agentName && firstUser) return truncate(`${agent.agentName} · ${firstUser}`);
  if (firstUser) return truncate(firstUser);
  if (agent?.agentName) return agent.agentName;
  return service ?? 'agent run';
}

function rollUp(all: TraceNode[]): { tokens: TokenUsage; costUsd: number | null } {
  const tokens: TokenUsage = {};
  let cost = 0;
  let anyCost = false;
  let anyInput = false;
  let anyOutput = false;
  let anyTotal = false;
  for (const node of all) {
    if (node.kind !== 'llm') continue;
    if (node.usage.input != null) {
      tokens.input = (tokens.input ?? 0) + node.usage.input;
      anyInput = true;
    }
    if (node.usage.output != null) {
      tokens.output = (tokens.output ?? 0) + node.usage.output;
      anyOutput = true;
    }
    if (node.usage.total != null) {
      tokens.total = (tokens.total ?? 0) + node.usage.total;
      anyTotal = true;
    }
    if (node.costUsd != null) {
      cost += node.costUsd;
      anyCost = true;
    }
  }
  if (!anyTotal && (anyInput || anyOutput)) {
    tokens.total = (tokens.input ?? 0) + (tokens.output ?? 0);
  }
  return { tokens, costUsd: anyCost ? cost : null };
}

function runStatus(all: TraceNode[]): Run['status'] {
  if (all.some((n) => n.status.code === StatusCode.Error)) {
    const errored = all.find((n) => n.status.code === StatusCode.Error);
    return {
      code: StatusCode.Error,
      ...(errored?.status.message ? { message: errored.status.message } : {}),
    };
  }
  if (all.some((n) => n.status.code === StatusCode.Ok)) return { code: StatusCode.Ok };
  return { code: StatusCode.Unset };
}

/**
 * Reconstruct a single {@link Run} (one trace) from a flat list of spans.
 *
 * Defensive throughout: spans arrive in any order; spans whose parent is absent
 * become roots; everything hangs under one synthetic run node so nothing is
 * dropped. Unknown operations degrade to generic `step` nodes.
 */
export function buildRun(rawSpans: Span[], options: BuildOptions = {}): Run {
  // Normalize vendor dialects (OpenInference, Vercel AI SDK, Claude Code, …)
  // into canonical gen_ai.* before reconstruction.
  const spans = rawSpans.map(normalizeSpan);
  const byId = new Map(spans.map((s) => [s.spanId, s]));
  const childSpans = new Map<string, Span[]>();
  const roots: Span[] = [];

  for (const span of spans) {
    const parentId = span.parentSpanId;
    if (parentId && byId.has(parentId)) {
      const list = childSpans.get(parentId) ?? [];
      list.push(span);
      childSpans.set(parentId, list);
    } else {
      roots.push(span);
    }
  }

  const traceId = spans[0]?.traceId ?? '';
  const service = spans
    .map((s) => s.resourceAttributes['service.name'])
    .find((v) => typeof v === 'string') as string | undefined;

  const rootNodes = roots
    .slice()
    .sort((a, b) => compareNano(a.startTimeUnixNano, b.startTimeUnixNano))
    .map((span) => buildNode(span, childSpans, options));

  const all = flatten(rootNodes);
  const starts = all.map((n) => n.startTimeUnixNano);
  const ends = all.map((n) => n.endTimeUnixNano);
  const start = minNano(starts);
  const end = maxNano(ends);

  const topAgent = rootNodes.find((n): n is AgentNode => n.kind === 'agent');
  const root: RunNode = {
    id: `run:${traceId || 'unknown'}`,
    kind: 'run',
    name: topAgent?.agentName ?? service ?? 'run',
    startTimeUnixNano: start,
    endTimeUnixNano: end,
    durationMs: durationMs(start, end),
    status: runStatus(all),
    attributes: {},
    children: rootNodes,
  };

  const { tokens, costUsd } = rollUp(all);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: traceId || root.id,
    traceId,
    summary: deriveSummary(all, service),
    startTimeUnixNano: start,
    endTimeUnixNano: end,
    durationMs: root.durationMs,
    status: root.status,
    tokens,
    costUsd,
    ...(service ? { service } : {}),
    root,
  };
}

/** Group spans by trace id and build one {@link Run} per trace. */
export function buildRuns(spans: Span[], options: BuildOptions = {}): Run[] {
  const byTrace = new Map<string, Span[]>();
  for (const span of spans) {
    const list = byTrace.get(span.traceId) ?? [];
    list.push(span);
    byTrace.set(span.traceId, list);
  }
  return [...byTrace.values()].map((group) => buildRun(group, options));
}
