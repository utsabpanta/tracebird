/**
 * @tracebird/core — span → agent-decision-tree reconstruction.
 *
 * Pure TypeScript, no filesystem or network access. Everything that touches the
 * outside world lives in `@tracebird/cli`.
 */

export * from './types.js';
export { compareNano, durationMs, nanoToEpochMs } from './time.js';
export { parseOtlp, anyValueToJs, keyValuesToAttributes } from './otlp/parse.js';
export type {
  ExportTraceServiceRequest,
  OtlpAnyValue,
  OtlpKeyValue,
  OtlpResourceSpans,
  OtlpScopeSpans,
  OtlpSpan,
} from './otlp/wire.js';
