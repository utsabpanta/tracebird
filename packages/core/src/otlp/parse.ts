import {
  type Attributes,
  type AttributeValue,
  type Span,
  type SpanEvent,
  SpanKind,
  StatusCode,
} from '../types.js';
import type {
  ExportTraceServiceRequest,
  OtlpAnyValue,
  OtlpKeyValue,
  OtlpResourceSpans,
  OtlpSpan,
  OtlpStatus,
} from './wire.js';

/** Convert a single OTLP `AnyValue` into a plain JS value. */
export function anyValueToJs(value: OtlpAnyValue | undefined): AttributeValue {
  if (value == null) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.intValue !== undefined) {
    return typeof value.intValue === 'string' ? Number(value.intValue) : value.intValue;
  }
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.bytesValue !== undefined) return value.bytesValue;
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values ?? []).map(anyValueToJs);
  }
  if (value.kvlistValue !== undefined) {
    return keyValuesToAttributes(value.kvlistValue.values);
  }
  return null;
}

/** Flatten an OTLP `KeyValue[]` into a plain record. */
export function keyValuesToAttributes(kvs: OtlpKeyValue[] | undefined): Attributes {
  const out: Attributes = {};
  for (const kv of kvs ?? []) {
    if (!kv || typeof kv.key !== 'string') continue;
    out[kv.key] = anyValueToJs(kv.value);
  }
  return out;
}

function normalizeStatus(status: OtlpStatus | undefined): Span['status'] {
  const code = status?.code;
  return {
    code: code === StatusCode.Ok || code === StatusCode.Error ? code : StatusCode.Unset,
    ...(status?.message ? { message: status.message } : {}),
  };
}

function normalizeKind(kind: number | undefined): SpanKind {
  return kind != null && kind >= SpanKind.Unspecified && kind <= SpanKind.Consumer
    ? (kind as SpanKind)
    : SpanKind.Internal;
}

function normalizeEvents(span: OtlpSpan): SpanEvent[] {
  return (span.events ?? []).map((e) => ({
    name: e.name ?? '',
    timeUnixNano: e.timeUnixNano ?? span.startTimeUnixNano ?? '0',
    attributes: keyValuesToAttributes(e.attributes),
  }));
}

function spanFrom(
  span: OtlpSpan,
  resourceAttributes: Attributes,
  scope: Span['scope'],
): Span | null {
  // A span with no id is unusable — skip it rather than corrupt the tree.
  if (!span.spanId) return null;
  return {
    traceId: span.traceId ?? '',
    spanId: span.spanId,
    ...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
    name: span.name ?? '(unnamed span)',
    kind: normalizeKind(span.kind),
    startTimeUnixNano: span.startTimeUnixNano ?? '0',
    endTimeUnixNano: span.endTimeUnixNano ?? span.startTimeUnixNano ?? '0',
    attributes: keyValuesToAttributes(span.attributes),
    events: normalizeEvents(span),
    status: normalizeStatus(span.status),
    ...(scope ? { scope } : {}),
    resourceAttributes,
  };
}

function scopeSpanGroups(rs: OtlpResourceSpans): { scope?: Span['scope']; spans?: OtlpSpan[] }[] {
  // Prefer the modern `scopeSpans`; fall back to the legacy field name.
  if (rs.scopeSpans?.length) {
    return rs.scopeSpans.map((ss) => ({
      scope: ss.scope?.name
        ? { name: ss.scope.name, ...(ss.scope.version ? { version: ss.scope.version } : {}) }
        : undefined,
      spans: ss.spans,
    }));
  }
  return (rs.instrumentationLibrarySpans ?? []).map((ils) => ({
    scope: ils.instrumentationLibrary?.name
      ? {
          name: ils.instrumentationLibrary.name,
          ...(ils.instrumentationLibrary.version
            ? { version: ils.instrumentationLibrary.version }
            : {}),
        }
      : undefined,
    spans: ils.spans,
  }));
}

/**
 * Parse an OTLP `ExportTraceServiceRequest` into a flat list of normalized spans.
 *
 * Pure and defensive: malformed entries are skipped, never thrown on. Resource
 * and scope context is propagated onto each span so downstream consumers don't
 * need the nesting.
 */
export function parseOtlp(request: ExportTraceServiceRequest | null | undefined): Span[] {
  const spans: Span[] = [];
  for (const rs of request?.resourceSpans ?? []) {
    const resourceAttributes = keyValuesToAttributes(rs.resource?.attributes);
    for (const group of scopeSpanGroups(rs)) {
      for (const raw of group.spans ?? []) {
        const span = spanFrom(raw, resourceAttributes, group.scope);
        if (span) spans.push(span);
      }
    }
  }
  return spans;
}
