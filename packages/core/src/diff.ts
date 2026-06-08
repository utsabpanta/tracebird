/**
 * Structural + text diff of two runs (or two LLM calls) — the "why did it behave
 * differently today?" engine. Pure, dependency-free.
 */

import type { ChatMessage, LlmCall, Run, ToolCall, TraceNode } from './types.js';

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

/** A single scalar field that differs between two nodes/runs. */
export interface FieldChange {
  field: string;
  a: string | number | boolean | null;
  b: string | number | boolean | null;
}

/** One piece of an inline text diff. */
export interface DiffSegment {
  type: 'equal' | 'add' | 'remove';
  value: string;
}

/** A labelled text diff (e.g. "prompt", "completion", "result"). */
export interface TextDiff {
  label: string;
  segments: DiffSegment[];
  changed: boolean;
}

/** A node in the aligned diff tree. */
export interface NodeDiff {
  status: DiffStatus;
  kind?: TraceNode['kind'];
  aId?: string;
  bId?: string;
  name: { a?: string; b?: string };
  fields: FieldChange[];
  texts: TextDiff[];
  children: NodeDiff[];
}

export interface RunDiff {
  fields: FieldChange[];
  root: NodeDiff;
  /** True if anything anywhere differs. */
  changed: boolean;
}

// ---------------------------------------------------------------------------
// Generic LCS — used for both word-level text diff and child alignment
// ---------------------------------------------------------------------------

type LcsOp<T> = { type: 'equal'; a: T; b: T } | { type: 'remove'; a: T } | { type: 'add'; b: T };

function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): LcsOp<T>[] {
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = eq(a[i], b[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops: LcsOp<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      ops.push({ type: 'equal', a: a[i], b: b[j] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ type: 'remove', a: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', b: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'remove', a: a[i++] });
  while (j < m) ops.push({ type: 'add', b: b[j++] });
  return ops;
}

// ---------------------------------------------------------------------------
// Text diff
// ---------------------------------------------------------------------------

/** Split into words while keeping whitespace as its own tokens (stable diff). */
function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

/** Word-level inline diff of two strings, with adjacent same-type runs merged. */
export function diffText(a: string, b: string): DiffSegment[] {
  const ops = lcs(tokenize(a), tokenize(b), (x, y) => x === y);
  const segments: DiffSegment[] = [];
  for (const op of ops) {
    const type = op.type === 'equal' ? 'equal' : op.type === 'remove' ? 'remove' : 'add';
    const value = op.type === 'add' ? op.b : op.a;
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.value += value;
    else segments.push({ type, value });
  }
  return segments;
}

function textChanged(segments: DiffSegment[]): boolean {
  return segments.some((s) => s.type !== 'equal');
}

function messagesToText(messages: ChatMessage[] | undefined): string {
  if (!messages) return '';
  return messages
    .map((m) => {
      const calls = m.toolCalls?.length
        ? '\n' +
          m.toolCalls.map((t) => `→ ${t.name}(${JSON.stringify(t.arguments ?? {})})`).join('\n')
        : '';
      return `${m.role}: ${m.content}${calls}`;
    })
    .join('\n\n');
}

function toText(value: unknown): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

// ---------------------------------------------------------------------------
// Field + node diff
// ---------------------------------------------------------------------------

type Scalar = string | number | boolean | null;

function pushChange(
  out: FieldChange[],
  field: string,
  a: Scalar | undefined,
  b: Scalar | undefined,
): void {
  const av = a ?? null;
  const bv = b ?? null;
  if (av !== bv) out.push({ field, a: av, b: bv });
}

function nodeFieldChanges(a: TraceNode | undefined, b: TraceNode | undefined): FieldChange[] {
  const out: FieldChange[] = [];
  pushChange(out, 'name', a?.name, b?.name);
  pushChange(out, 'status', a && statusName(a), b && statusName(b));
  if (a?.kind === 'llm' || b?.kind === 'llm') {
    const al = a?.kind === 'llm' ? (a as LlmCall) : undefined;
    const bl = b?.kind === 'llm' ? (b as LlmCall) : undefined;
    pushChange(out, 'model', al?.model, bl?.model);
    pushChange(out, 'input_tokens', al?.usage.input, bl?.usage.input);
    pushChange(out, 'output_tokens', al?.usage.output, bl?.usage.output);
    pushChange(out, 'cost_usd', al?.costUsd ?? null, bl?.costUsd ?? null);
  }
  if (a?.kind === 'tool' || b?.kind === 'tool') {
    const at = a?.kind === 'tool' ? (a as ToolCall) : undefined;
    const bt = b?.kind === 'tool' ? (b as ToolCall) : undefined;
    pushChange(out, 'tool', at?.toolName, bt?.toolName);
    pushChange(out, 'is_error', at?.isError ?? null, bt?.isError ?? null);
  }
  return out;
}

function statusName(node: TraceNode): string {
  return node.status.code === 2 ? 'error' : node.status.code === 1 ? 'ok' : 'unset';
}

function nodeTextDiffs(a: TraceNode | undefined, b: TraceNode | undefined): TextDiff[] {
  const out: TextDiff[] = [];
  const add = (label: string, ta: string, tb: string) => {
    if (!ta && !tb) return;
    const segments = diffText(ta, tb);
    out.push({ label, segments, changed: textChanged(segments) });
  };
  if (a?.kind === 'llm' || b?.kind === 'llm') {
    const al = a?.kind === 'llm' ? (a as LlmCall) : undefined;
    const bl = b?.kind === 'llm' ? (b as LlmCall) : undefined;
    add('prompt', messagesToText(al?.prompt), messagesToText(bl?.prompt));
    add('completion', messagesToText(al?.completion), messagesToText(bl?.completion));
  }
  if (a?.kind === 'tool' || b?.kind === 'tool') {
    const at = a?.kind === 'tool' ? (a as ToolCall) : undefined;
    const bt = b?.kind === 'tool' ? (b as ToolCall) : undefined;
    add('arguments', toText(at?.arguments), toText(bt?.arguments));
    add('result', toText(at?.result), toText(bt?.result));
  }
  return out;
}

function nodeKey(node: TraceNode): string {
  // Align on logical identity, not the display name: the model often appears in
  // an LLM span's name and is exactly the thing that changes between runs.
  if (node.kind === 'llm') return 'llm';
  if (node.kind === 'tool') return `tool:${(node as ToolCall).toolName ?? node.name}`;
  return `${node.kind}:${node.name}`;
}

function diffNode(a: TraceNode | undefined, b: TraceNode | undefined): NodeDiff {
  const fields = a && b ? nodeFieldChanges(a, b) : [];
  const texts = a && b ? nodeTextDiffs(a, b) : [];
  const children = alignChildren(a?.children ?? [], b?.children ?? []);

  let status: DiffStatus;
  if (!a) status = 'added';
  else if (!b) status = 'removed';
  else {
    const childChanged = children.some((c) => c.status !== 'unchanged');
    const selfChanged = fields.length > 0 || texts.some((t) => t.changed);
    status = selfChanged || childChanged ? 'changed' : 'unchanged';
  }

  return {
    status,
    kind: (a ?? b)?.kind,
    aId: a?.id,
    bId: b?.id,
    name: { a: a?.name, b: b?.name },
    fields,
    texts,
    children,
  };
}

function alignChildren(a: TraceNode[], b: TraceNode[]): NodeDiff[] {
  const ops = lcs(a, b, (x, y) => nodeKey(x) === nodeKey(y));
  return ops.map((op) => {
    if (op.type === 'equal') return diffNode(op.a, op.b);
    if (op.type === 'remove') return diffNode(op.a, undefined);
    return diffNode(undefined, op.b);
  });
}

function runFieldChanges(a: Run, b: Run): FieldChange[] {
  const out: FieldChange[] = [];
  pushChange(
    out,
    'status',
    a.status.code === 2 ? 'error' : 'ok',
    b.status.code === 2 ? 'error' : 'ok',
  );
  pushChange(out, 'total_tokens', a.tokens.total ?? null, b.tokens.total ?? null);
  pushChange(out, 'cost_usd', a.costUsd, b.costUsd);
  pushChange(out, 'service', a.service ?? null, b.service ?? null);
  return out;
}

/** Diff two runs into an aligned tree of changes. */
export function diffRuns(a: Run, b: Run): RunDiff {
  const fields = runFieldChanges(a, b);
  const root = diffNode(a.root, b.root);
  return { fields, root, changed: fields.length > 0 || root.status !== 'unchanged' };
}

export interface CallDiff {
  fields: FieldChange[];
  prompt: TextDiff;
  completion: TextDiff;
  changed: boolean;
}

/** Diff two LLM calls: scalar fields plus prompt/completion text diffs. */
export function diffCalls(a: LlmCall, b: LlmCall): CallDiff {
  const fields = nodeFieldChanges(a, b);
  const promptSegments = diffText(messagesToText(a.prompt), messagesToText(b.prompt));
  const completionSegments = diffText(messagesToText(a.completion), messagesToText(b.completion));
  const prompt: TextDiff = {
    label: 'prompt',
    segments: promptSegments,
    changed: textChanged(promptSegments),
  };
  const completion: TextDiff = {
    label: 'completion',
    segments: completionSegments,
    changed: textChanged(completionSegments),
  };
  return {
    fields,
    prompt,
    completion,
    changed: fields.length > 0 || prompt.changed || completion.changed,
  };
}
