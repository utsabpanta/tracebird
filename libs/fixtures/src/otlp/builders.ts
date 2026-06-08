/**
 * Tiny builders for assembling OTLP/HTTP JSON trace payloads by hand.
 *
 * Intentionally self-contained — fixtures import nothing internal so the
 * project graph stays acyclic (core's tests depend on fixtures, not vice-versa).
 * The emitted shape matches the OTLP/JSON protobuf mapping that
 * `@tracebird/core`'s `parseOtlp` consumes.
 */

export interface AnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string;
  doubleValue?: number;
  arrayValue?: { values: AnyValue[] };
}

export interface KeyValue {
  key: string;
  value: AnyValue;
}

export type AttrInput = string | number | boolean;

function toAnyValue(v: AttrInput): AnyValue {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { boolValue: v };
  return Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v };
}

/** Convert a flat record into an OTLP `KeyValue[]`. */
export function attrs(record: Record<string, AttrInput>): KeyValue[] {
  return Object.entries(record).map(([key, v]) => ({ key, value: toAnyValue(v) }));
}

export interface SpanInput {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: Record<string, AttrInput>;
  /** OTLP status code: 0 unset, 1 ok, 2 error. */
  statusCode?: number;
  statusMessage?: string;
}

export interface OtlpSpanJson {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: KeyValue[];
  status: { code: number; message?: string };
}

export function span(input: SpanInput): OtlpSpanJson {
  return {
    traceId: input.traceId,
    spanId: input.spanId,
    ...(input.parentSpanId ? { parentSpanId: input.parentSpanId } : {}),
    name: input.name,
    kind: input.kind ?? 1,
    startTimeUnixNano: input.startTimeUnixNano,
    endTimeUnixNano: input.endTimeUnixNano,
    attributes: attrs(input.attributes ?? {}),
    status: {
      code: input.statusCode ?? 0,
      ...(input.statusMessage ? { message: input.statusMessage } : {}),
    },
  };
}

export interface TraceRequestInput {
  serviceName: string;
  scopeName: string;
  scopeVersion?: string;
  spans: OtlpSpanJson[];
}

/** Wrap spans into a complete `ExportTraceServiceRequest` JSON payload. */
export function traceRequest(input: TraceRequestInput) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: attrs({ 'service.name': input.serviceName }),
        },
        scopeSpans: [
          {
            scope: {
              name: input.scopeName,
              ...(input.scopeVersion ? { version: input.scopeVersion } : {}),
            },
            spans: input.spans,
          },
        ],
      },
    ],
  };
}

/** Nanosecond timestamp helper: base epoch-nanos + a millisecond offset. */
export function at(baseNano: bigint, offsetMs: number): string {
  return (baseNano + BigInt(offsetMs) * 1_000_000n).toString();
}
