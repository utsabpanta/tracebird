/**
 * Helpers for reading the OpenTelemetry **GenAI** semantic conventions off a
 * span. These conventions are experimental and emitters disagree, so every
 * helper is best-effort and defensive: it tries several known shapes and
 * returns `undefined` rather than throwing when nothing matches.
 */

import type { Attributes, AttributeValue, ChatMessage, NodeKind, Span, TokenUsage } from './types.js';

function asString(v: AttributeValue | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: AttributeValue | undefined): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

/** The raw `gen_ai.operation.name`, if present. */
export function operationName(span: Span): string | undefined {
  return asString(span.attributes['gen_ai.operation.name']);
}

/**
 * Map a span to a node kind. Uses `gen_ai.operation.name` when present, then
 * falls back to other signals (tool name, model/usage attrs, span name) so we
 * still classify spans from instrumentations that omit the operation.
 */
export function classifyKind(span: Span): NodeKind {
  const op = operationName(span);
  switch (op) {
    case 'chat':
    case 'text_completion':
    case 'generate_content':
    case 'embeddings':
      return 'llm';
    case 'execute_tool':
      return 'tool';
    case 'invoke_agent':
    case 'create_agent':
      return 'agent';
    default:
      break;
  }
  if (op) return 'step'; // known-but-unmodelled operation — never lose it.

  // No operation attribute: infer from other evidence.
  const a = span.attributes;
  if (asString(a['gen_ai.tool.name'])) return 'tool';
  if (
    asString(a['gen_ai.request.model']) ||
    asString(a['gen_ai.response.model']) ||
    a['gen_ai.usage.input_tokens'] != null ||
    a['gen_ai.usage.output_tokens'] != null
  ) {
    return 'llm';
  }
  const name = span.name.toLowerCase();
  if (name.startsWith('execute_tool') || name.startsWith('tool')) return 'tool';
  if (name.startsWith('invoke_agent') || name.startsWith('create_agent')) return 'agent';
  if (name.startsWith('chat') || name.startsWith('completion')) return 'llm';
  return 'step';
}

export function requestModel(span: Span): string | undefined {
  return (
    asString(span.attributes['gen_ai.request.model']) ??
    asString(span.attributes['gen_ai.response.model']) ??
    asString(span.attributes['llm.request.model'])
  );
}

export function provider(span: Span): string | undefined {
  return (
    asString(span.attributes['gen_ai.system']) ??
    asString(span.attributes['gen_ai.provider.name'])
  );
}

export function agentName(span: Span): string | undefined {
  return asString(span.attributes['gen_ai.agent.name']);
}

export function toolName(span: Span): string | undefined {
  return (
    asString(span.attributes['gen_ai.tool.name']) ??
    asString(span.attributes['gen_ai.tool.call.name'])
  );
}

/** Extract token usage, tolerating the legacy `prompt_/completion_tokens` names. */
export function extractUsage(span: Span): TokenUsage {
  const a = span.attributes;
  const input =
    asNumber(a['gen_ai.usage.input_tokens']) ?? asNumber(a['gen_ai.usage.prompt_tokens']);
  const output =
    asNumber(a['gen_ai.usage.output_tokens']) ?? asNumber(a['gen_ai.usage.completion_tokens']);
  const total =
    asNumber(a['gen_ai.usage.total_tokens']) ??
    (input != null || output != null ? (input ?? 0) + (output ?? 0) : undefined);
  const usage: TokenUsage = {};
  if (input != null) usage.input = input;
  if (output != null) usage.output = output;
  if (total != null) usage.total = total;
  return usage;
}

// ---------------------------------------------------------------------------
// Prompt / completion message extraction
// ---------------------------------------------------------------------------

function parseMaybeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Collect `gen_ai.<group>.<i>.{role,content,tool_calls.*}` indexed attributes. */
function messagesFromIndexedAttrs(attrs: Attributes, group: string): ChatMessage[] {
  const prefix = `gen_ai.${group}.`;
  const byIndex = new Map<number, ChatMessage>();
  const toolCalls = new Map<number, Map<number, { id?: string; name?: string; arguments?: unknown }>>();

  for (const [key, value] of Object.entries(attrs)) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const idxMatch = /^(\d+)\.(.*)$/.exec(rest);
    if (!idxMatch) continue;
    const i = Number(idxMatch[1]);
    const field = idxMatch[2];
    const msg = byIndex.get(i) ?? { role: 'unknown', content: '' };

    if (field === 'role') {
      msg.role = asString(value) ?? msg.role;
    } else if (field === 'content') {
      msg.content = typeof value === 'string' ? value : JSON.stringify(value);
    } else {
      const tc = /^tool_calls\.(\d+)\.(.*)$/.exec(field);
      if (tc) {
        const j = Number(tc[1]);
        const tcField = tc[2];
        const calls = toolCalls.get(i) ?? new Map();
        const call = calls.get(j) ?? {};
        if (tcField === 'id') call.id = asString(value);
        else if (tcField === 'name' || tcField === 'function.name') call.name = asString(value);
        else if (tcField === 'arguments' || tcField === 'function.arguments')
          call.arguments = typeof value === 'string' ? parseMaybeJson(value) : value;
        calls.set(j, call);
        toolCalls.set(i, calls);
      }
    }
    byIndex.set(i, msg);
  }

  for (const [i, calls] of toolCalls) {
    const msg = byIndex.get(i);
    if (msg) {
      msg.toolCalls = [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
    }
  }

  return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m);
}

function normalizeMessageList(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): ChatMessage => {
    if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const role = typeof obj.role === 'string' ? obj.role : 'unknown';
      const content =
        typeof obj.content === 'string'
          ? obj.content
          : obj.content == null
            ? ''
            : JSON.stringify(obj.content);
      return { role, content };
    }
    return { role: 'unknown', content: String(entry) };
  });
}

/** Pull messages out of `gen_ai.input.messages` / `gen_ai.output.messages` JSON. */
function messagesFromJsonAttr(attrs: Attributes, keys: string[]): ChatMessage[] {
  for (const key of keys) {
    const value = attrs[key];
    if (value == null) continue;
    const parsed = typeof value === 'string' ? parseMaybeJson(value) : value;
    const list = normalizeMessageList(parsed);
    if (list.length) return list;
  }
  return [];
}

const EVENT_ROLE: Record<string, string> = {
  'gen_ai.system.message': 'system',
  'gen_ai.user.message': 'user',
  'gen_ai.assistant.message': 'assistant',
  'gen_ai.tool.message': 'tool',
  'gen_ai.choice': 'assistant',
};

/** Pull messages out of span events (event-based content capture). */
function messagesFromEvents(span: Span, kind: 'prompt' | 'completion'): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const event of span.events) {
    const role = EVENT_ROLE[event.name];
    if (!role) continue;
    const isChoice = event.name === 'gen_ai.choice';
    if (kind === 'completion' ? !isChoice : isChoice) continue;
    const content = event.attributes['content'] ?? event.attributes['gen_ai.event.content'];
    out.push({
      role: asString(event.attributes['role']) ?? role,
      content: typeof content === 'string' ? content : content == null ? '' : JSON.stringify(content),
    });
  }
  return out;
}

/** Extract the prompt (input) or completion (output) messages from a span. */
export function extractMessages(span: Span, kind: 'prompt' | 'completion'): ChatMessage[] | undefined {
  const indexed = messagesFromIndexedAttrs(span.attributes, kind);
  if (indexed.length) return indexed;

  const jsonKeys =
    kind === 'prompt'
      ? ['gen_ai.input.messages', 'gen_ai.prompt']
      : ['gen_ai.output.messages', 'gen_ai.completion'];
  const json = messagesFromJsonAttr(span.attributes, jsonKeys);
  if (json.length) return json;

  const events = messagesFromEvents(span, kind);
  if (events.length) return events;

  return undefined;
}

/** Extract a tool call's arguments and result from the various known attrs. */
export function extractToolIo(span: Span): { arguments?: unknown; result?: unknown } {
  const a = span.attributes;
  const argRaw =
    a['gen_ai.tool.call.arguments'] ?? a['gen_ai.tool.input'] ?? a['traceloop.entity.input'];
  const resRaw =
    a['gen_ai.tool.call.result'] ?? a['gen_ai.tool.output'] ?? a['traceloop.entity.output'];
  const io: { arguments?: unknown; result?: unknown } = {};
  if (argRaw != null) io.arguments = typeof argRaw === 'string' ? parseMaybeJson(argRaw) : argRaw;
  if (resRaw != null) io.result = typeof resRaw === 'string' ? parseMaybeJson(resRaw) : resRaw;
  return io;
}
