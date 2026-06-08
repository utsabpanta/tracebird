/**
 * Minimal TypeScript shapes for the OTLP/HTTP JSON trace payload
 * (`ExportTraceServiceRequest`), following the protobuf-JSON mapping.
 *
 * The CLI's protobuf decoder is configured to emit the exact same camelCase
 * shape, so {@link parseOtlp} only ever has to understand one format.
 *
 * Spec: https://opentelemetry.io/docs/specs/otlp/ (trace_id/span_id are hex in JSON).
 */

export interface OtlpAnyValue {
  stringValue?: string;
  boolValue?: boolean;
  /** int64 is encoded as a string in OTLP/JSON, but some emitters use a number. */
  intValue?: string | number;
  doubleValue?: number;
  arrayValue?: { values?: OtlpAnyValue[] };
  kvlistValue?: { values?: OtlpKeyValue[] };
  bytesValue?: string;
}

export interface OtlpKeyValue {
  key: string;
  value?: OtlpAnyValue;
}

export interface OtlpResource {
  attributes?: OtlpKeyValue[];
}

export interface OtlpInstrumentationScope {
  name?: string;
  version?: string;
  attributes?: OtlpKeyValue[];
}

export interface OtlpEvent {
  timeUnixNano?: string;
  name?: string;
  attributes?: OtlpKeyValue[];
}

export interface OtlpStatus {
  code?: number;
  message?: string;
}

export interface OtlpSpan {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  kind?: number;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  attributes?: OtlpKeyValue[];
  events?: OtlpEvent[];
  status?: OtlpStatus;
}

export interface OtlpScopeSpans {
  scope?: OtlpInstrumentationScope;
  spans?: OtlpSpan[];
}

/** Legacy (pre-0.9) field name some exporters still emit. */
export interface OtlpInstrumentationLibrarySpans {
  instrumentationLibrary?: OtlpInstrumentationScope;
  spans?: OtlpSpan[];
}

export interface OtlpResourceSpans {
  resource?: OtlpResource;
  scopeSpans?: OtlpScopeSpans[];
  instrumentationLibrarySpans?: OtlpInstrumentationLibrarySpans[];
}

export interface ExportTraceServiceRequest {
  resourceSpans?: OtlpResourceSpans[];
}
