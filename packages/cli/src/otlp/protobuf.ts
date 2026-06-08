import protobuf from 'protobufjs';
import type { ExportTraceServiceRequest } from '@tracebird/core';

/**
 * Decode OTLP/HTTP protobuf trace payloads without a build-time codegen step.
 *
 * Most OpenTelemetry SDKs default to `http/protobuf`, so this is the path that
 * makes tracebird genuinely drop-in. We describe just the subset of the OTLP
 * trace schema we need as a protobufjs JSON descriptor, decode, then convert to
 * the exact same camelCase shape that `parseOtlp` consumes from OTLP/JSON
 * (hex trace/span ids, stringified nanos).
 */

const common = {
  AnyValue: {
    oneofs: { value: { oneof: ['stringValue', 'boolValue', 'intValue', 'doubleValue', 'arrayValue', 'kvlistValue', 'bytesValue'] } },
    fields: {
      stringValue: { type: 'string', id: 1 },
      boolValue: { type: 'bool', id: 2 },
      intValue: { type: 'int64', id: 3 },
      doubleValue: { type: 'double', id: 4 },
      arrayValue: { type: 'ArrayValue', id: 5 },
      kvlistValue: { type: 'KeyValueList', id: 6 },
      bytesValue: { type: 'bytes', id: 7 },
    },
  },
  ArrayValue: { fields: { values: { rule: 'repeated', type: 'AnyValue', id: 1 } } },
  KeyValueList: { fields: { values: { rule: 'repeated', type: 'KeyValue', id: 1 } } },
  KeyValue: {
    fields: { key: { type: 'string', id: 1 }, value: { type: 'AnyValue', id: 2 } },
  },
  InstrumentationScope: {
    fields: {
      name: { type: 'string', id: 1 },
      version: { type: 'string', id: 2 },
      attributes: { rule: 'repeated', type: 'KeyValue', id: 3 },
    },
  },
};

const KV = 'opentelemetry.proto.common.v1.KeyValue';

const descriptor = {
  nested: {
    opentelemetry: {
      nested: {
        proto: {
          nested: {
            common: { nested: { v1: { nested: common } } },
            resource: {
              nested: {
                v1: {
                  nested: {
                    Resource: {
                      fields: { attributes: { rule: 'repeated', type: KV, id: 1 } },
                    },
                  },
                },
              },
            },
            trace: {
              nested: {
                v1: {
                  nested: {
                    ResourceSpans: {
                      fields: {
                        resource: { type: 'opentelemetry.proto.resource.v1.Resource', id: 1 },
                        scopeSpans: { rule: 'repeated', type: 'ScopeSpans', id: 2 },
                        schemaUrl: { type: 'string', id: 3 },
                      },
                    },
                    ScopeSpans: {
                      fields: {
                        scope: {
                          type: 'opentelemetry.proto.common.v1.InstrumentationScope',
                          id: 1,
                        },
                        spans: { rule: 'repeated', type: 'Span', id: 2 },
                        schemaUrl: { type: 'string', id: 3 },
                      },
                    },
                    Span: {
                      fields: {
                        traceId: { type: 'bytes', id: 1 },
                        spanId: { type: 'bytes', id: 2 },
                        traceState: { type: 'string', id: 3 },
                        parentSpanId: { type: 'bytes', id: 4 },
                        name: { type: 'string', id: 5 },
                        kind: { type: 'int32', id: 6 },
                        startTimeUnixNano: { type: 'fixed64', id: 7 },
                        endTimeUnixNano: { type: 'fixed64', id: 8 },
                        attributes: { rule: 'repeated', type: KV, id: 9 },
                        events: { rule: 'repeated', type: 'Event', id: 11 },
                        status: { type: 'Status', id: 15 },
                      },
                      nested: {
                        Event: {
                          fields: {
                            timeUnixNano: { type: 'fixed64', id: 1 },
                            name: { type: 'string', id: 2 },
                            attributes: { rule: 'repeated', type: KV, id: 3 },
                          },
                        },
                      },
                    },
                    Status: {
                      fields: {
                        message: { type: 'string', id: 2 },
                        code: { type: 'int32', id: 3 },
                      },
                    },
                  },
                },
              },
            },
            collector: {
              nested: {
                trace: {
                  nested: {
                    v1: {
                      nested: {
                        ExportTraceServiceRequest: {
                          fields: {
                            resourceSpans: {
                              rule: 'repeated',
                              type: 'opentelemetry.proto.trace.v1.ResourceSpans',
                              id: 1,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const root = protobuf.Root.fromJSON(descriptor);
const RequestType = root.lookupType(
  'opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest',
);

function hexToBytes(hex: string | undefined): Uint8Array {
  if (!hex) return new Uint8Array(0);
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: unknown): string | undefined {
  if (!bytes) return undefined;
  const arr: number[] = Array.isArray(bytes)
    ? bytes
    : bytes instanceof Uint8Array
      ? Array.from(bytes)
      : [];
  if (arr.length === 0) return undefined;
  return arr.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

interface RawSpan {
  traceId?: unknown;
  spanId?: unknown;
  parentSpanId?: unknown;
  [key: string]: unknown;
}

/** Decode an OTLP/protobuf body into the JSON `ExportTraceServiceRequest` shape. */
export function decodeProtobufTraces(body: Uint8Array): ExportTraceServiceRequest {
  const message = RequestType.decode(body);
  const obj = RequestType.toObject(message, {
    longs: String,
    enums: Number,
    bytes: Array,
    defaults: false,
    arrays: true,
    objects: true,
  }) as ExportTraceServiceRequest;

  // protobuf carries trace/span ids as bytes; OTLP/JSON (and parseOtlp) want hex.
  for (const rs of obj.resourceSpans ?? []) {
    for (const ss of rs.scopeSpans ?? []) {
      for (const span of (ss.spans ?? []) as RawSpan[]) {
        span.traceId = bytesToHex(span.traceId) ?? '';
        span.spanId = bytesToHex(span.spanId) ?? '';
        const parent = bytesToHex(span.parentSpanId);
        if (parent) span.parentSpanId = parent;
        else delete span.parentSpanId;
      }
    }
  }
  return obj;
}

interface MutableSpan {
  traceId?: unknown;
  spanId?: unknown;
  parentSpanId?: unknown;
}

/**
 * Encode a JSON `ExportTraceServiceRequest` (hex ids, string nanos) back into
 * OTLP/protobuf bytes. The inverse of {@link decodeProtobufTraces}; used by
 * tests and the e2e harness to exercise the protobuf ingest path.
 */
export function encodeProtobufTraces(request: ExportTraceServiceRequest): Uint8Array {
  const clone = structuredClone(request) as ExportTraceServiceRequest;
  for (const rs of clone.resourceSpans ?? []) {
    for (const ss of rs.scopeSpans ?? []) {
      for (const span of (ss.spans ?? []) as MutableSpan[]) {
        span.traceId = hexToBytes(span.traceId as string | undefined);
        span.spanId = hexToBytes(span.spanId as string | undefined);
        if (span.parentSpanId) span.parentSpanId = hexToBytes(span.parentSpanId as string);
        else delete span.parentSpanId;
      }
    }
  }
  const message = RequestType.fromObject(clone as Record<string, unknown>);
  return RequestType.encode(message).finish();
}
