/**
 * @tracebird/core — span → agent-decision-tree reconstruction.
 *
 * Pure TypeScript, no filesystem or network access. Everything that touches the
 * outside world lives in `@tracebird/cli`.
 */

export * from './types.js';
export { compareNano, durationMs, nanoToEpochMs } from './time.js';
export { parseOtlp, anyValueToJs, keyValuesToAttributes } from './otlp/parse.js';
export { buildRun, buildRuns, type BuildOptions } from './build.js';
export {
  estimateCost,
  normalizeModel,
  DEFAULT_PRICES,
  type ModelPrice,
  type PriceTable,
} from './cost.js';
export {
  classifyKind,
  operationName,
  requestModel,
  provider,
  agentName,
  toolName,
  extractUsage,
  extractMessages,
  extractToolIo,
} from './genai.js';
export {
  serializeRun,
  parseRun,
  serializeSession,
  parseSession,
  RunParseError,
} from './serialize.js';
export { normalizeSpan, detectDialect, ADAPTERS, type Adapter } from './adapters/index.js';
export { runMatches, runSearchText } from './search.js';
export { diffRuns, diffCalls, diffText } from './diff.js';
export type {
  RunDiff,
  CallDiff,
  NodeDiff,
  FieldChange,
  TextDiff,
  DiffSegment,
  DiffStatus,
} from './diff.js';
export type {
  ExportTraceServiceRequest,
  OtlpAnyValue,
  OtlpKeyValue,
  OtlpResourceSpans,
  OtlpScopeSpans,
  OtlpSpan,
} from './otlp/wire.js';
