/**
 * Normalized data model for tracebird.
 *
 * Two layers live here:
 *  1. {@link Span} — a flat, framework-agnostic span (the output of OTLP ingest).
 *  2. The reconstructed agent tree — {@link Run} / {@link TraceNode} and friends.
 *
 * Keep this file free of behaviour; it is types only.
 */

/** A flattened attribute value. OTLP arrays/maps are normalized to JS arrays/records. */
export type AttributeValue =
  | string
  | number
  | boolean
  | null
  | AttributeValue[]
  | { [key: string]: AttributeValue };

export type Attributes = Record<string, AttributeValue>;

/** OpenTelemetry span kind (numeric, per the OTLP enum). */
export enum SpanKind {
  Unspecified = 0,
  Internal = 1,
  Server = 2,
  Client = 3,
  Producer = 4,
  Consumer = 5,
}

/** OpenTelemetry status code (numeric, per the OTLP enum). */
export enum StatusCode {
  Unset = 0,
  Ok = 1,
  Error = 2,
}

export interface SpanStatus {
  code: StatusCode;
  message?: string;
}

export interface InstrumentationScope {
  name: string;
  version?: string;
}

export interface SpanEvent {
  name: string;
  /** Unix nanoseconds, kept as a string to avoid precision loss. */
  timeUnixNano: string;
  attributes: Attributes;
}

/**
 * A single normalized span. Timestamps are kept as their raw uint64 nanosecond
 * strings (lossless); use the helpers in `time.ts` to derive millis/durations.
 */
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Attributes;
  events: SpanEvent[];
  status: SpanStatus;
  scope?: InstrumentationScope;
  /** Resource-level attributes (service.name, etc.) propagated from the resource. */
  resourceAttributes: Attributes;
}

// ---------------------------------------------------------------------------
// Reconstructed agent tree
// ---------------------------------------------------------------------------

/** Discriminator for {@link TraceNode}. */
export type NodeKind = 'run' | 'agent' | 'step' | 'llm' | 'tool';

export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

/** Fields common to every node in the reconstructed tree. */
export interface BaseNode {
  /** Stable id — the originating span id (or a synthetic id for the root). */
  id: string;
  kind: NodeKind;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  status: SpanStatus;
  attributes: Attributes;
  children: TraceNode[];
}

export interface RunNode extends BaseNode {
  kind: 'run';
}

export interface AgentNode extends BaseNode {
  kind: 'agent';
  agentName?: string;
}

/** A generic step — used for unknown/experimental operations so nothing is lost. */
export interface StepNode extends BaseNode {
  kind: 'step';
  operation?: string;
}

export interface LlmCall extends BaseNode {
  kind: 'llm';
  model?: string;
  provider?: string;
  prompt?: ChatMessage[];
  completion?: ChatMessage[];
  usage: TokenUsage;
  /** Estimated cost in USD, or null when the model is not in the price table. */
  costUsd: number | null;
}

export interface ToolCall extends BaseNode {
  kind: 'tool';
  toolName?: string;
  arguments?: unknown;
  result?: unknown;
  isError: boolean;
}

export type TraceNode = RunNode | AgentNode | StepNode | LlmCall | ToolCall;

export interface ChatMessage {
  role: string;
  content: string;
  /** Tool calls requested by an assistant message, if any. */
  toolCalls?: { id?: string; name?: string; arguments?: unknown }[];
}

/**
 * A fully reconstructed run: the tree plus rolled-up summary metrics.
 * This is the unit that is serialized to a `.jsonl` session file.
 */
export interface Run {
  schemaVersion: number;
  id: string;
  traceId: string;
  /** Best-effort human summary of the task (first user prompt, agent name, …). */
  summary: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  durationMs: number;
  status: SpanStatus;
  tokens: TokenUsage;
  costUsd: number | null;
  /** Service / framework that produced the run, if discoverable. */
  service?: string;
  root: RunNode;
}

export const SCHEMA_VERSION = 1;
