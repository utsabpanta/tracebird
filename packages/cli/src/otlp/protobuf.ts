import type { ExportTraceServiceRequest } from '@tracebird/core';

/**
 * Decode OTLP/HTTP **protobuf** trace payloads with zero dependencies.
 *
 * Most OpenTelemetry SDKs default to `http/protobuf`, so this is the path that
 * makes tracebird genuinely drop-in. Rather than pull in a protobuf runtime, we
 * hand-roll a minimal reader/writer for exactly the subset of the OTLP trace
 * schema we need, and emit the same camelCase shape `parseOtlp` consumes from
 * OTLP/JSON (hex trace/span ids, stringified nanos).
 *
 * Wire format: https://protobuf.dev/programming-guides/encoding/
 * OTLP trace schema (field numbers below):
 * https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/trace/v1/trace.proto
 */

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

// Wire types
const VARINT = 0;
const I64 = 1;
const LEN = 2;
const I32 = 5;

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

class Reader {
  pos = 0;
  constructor(private readonly buf: Uint8Array) {}

  get eof(): boolean {
    return this.pos >= this.buf.length;
  }

  varint(): bigint {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      const byte = this.buf[this.pos++];
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7n;
    }
    return result;
  }

  tag(): { field: number; wire: number } {
    const v = Number(this.varint());
    return { field: v >>> 3, wire: v & 7 };
  }

  fixed64(): bigint {
    let v = 0n;
    for (let i = 0; i < 8; i++) v |= BigInt(this.buf[this.pos++]) << BigInt(8 * i);
    return v;
  }

  double(): number {
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8);
    this.pos += 8;
    return view.getFloat64(0, true);
  }

  bytes(): Uint8Array {
    const len = Number(this.varint());
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  string(): string {
    return textDecoder.decode(this.bytes());
  }

  /** Skip an unknown field by its wire type, preserving forward-compatibility. */
  skip(wire: number): void {
    if (wire === VARINT) this.varint();
    else if (wire === I64) this.pos += 8;
    else if (wire === LEN) this.bytes();
    else if (wire === I32) this.pos += 4;
    else throw new Error(`unsupported wire type ${wire}`);
  }
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += (b & 0xff).toString(16).padStart(2, '0');
  return hex;
}

// Each parser takes the message's bytes and returns the JSON-shaped object.

function parseAnyValue(buf: Uint8Array): Record<string, unknown> {
  const r = new Reader(buf);
  const out: Record<string, unknown> = {};
  while (!r.eof) {
    const { field, wire } = r.tag();
    switch (field) {
      case 1:
        out.stringValue = r.string();
        break;
      case 2:
        out.boolValue = r.varint() !== 0n;
        break;
      case 3:
        out.intValue = r.varint().toString();
        break;
      case 4:
        out.doubleValue = r.double();
        break;
      case 5:
        out.arrayValue = { values: parseRepeated(r.bytes(), parseAnyValue) };
        break;
      case 6:
        out.kvlistValue = { values: parseRepeated(r.bytes(), parseKeyValue) };
        break;
      case 7:
        out.bytesValue = bytesToHex(r.bytes());
        break;
      default:
        r.skip(wire);
    }
  }
  return out;
}

function parseRepeated<T>(buf: Uint8Array, parse: (b: Uint8Array) => T): T[] {
  // A KeyValueList / ArrayList message: repeated field #1 of sub-messages.
  const r = new Reader(buf);
  const out: T[] = [];
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === LEN) out.push(parse(r.bytes()));
    else r.skip(wire);
  }
  return out;
}

function parseKeyValue(buf: Uint8Array): Record<string, unknown> {
  const r = new Reader(buf);
  const kv: Record<string, unknown> = {};
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) kv.key = r.string();
    else if (field === 2) kv.value = parseAnyValue(r.bytes());
    else r.skip(wire);
  }
  return kv;
}

function parseKeyValues(buf: Uint8Array, into: Record<string, unknown>[]): void {
  into.push(parseKeyValue(buf));
}

function parseEvent(buf: Uint8Array): Record<string, unknown> {
  const r = new Reader(buf);
  const ev: Record<string, unknown> = {};
  const attributes: Record<string, unknown>[] = [];
  while (!r.eof) {
    const { field, wire } = r.tag();
    switch (field) {
      case 1:
        ev.timeUnixNano = r.fixed64().toString();
        break;
      case 2:
        ev.name = r.string();
        break;
      case 3:
        parseKeyValues(r.bytes(), attributes);
        break;
      default:
        r.skip(wire);
    }
  }
  if (attributes.length) ev.attributes = attributes;
  return ev;
}

function parseStatus(buf: Uint8Array): Record<string, unknown> {
  const r = new Reader(buf);
  const status: Record<string, unknown> = {};
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 2) status.message = r.string();
    else if (field === 3) status.code = Number(r.varint());
    else r.skip(wire);
  }
  return status;
}

function parseSpan(buf: Uint8Array): Record<string, unknown> {
  const r = new Reader(buf);
  const span: Record<string, unknown> = {};
  const attributes: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  while (!r.eof) {
    const { field, wire } = r.tag();
    switch (field) {
      case 1:
        span.traceId = bytesToHex(r.bytes());
        break;
      case 2:
        span.spanId = bytesToHex(r.bytes());
        break;
      case 4: {
        const parent = bytesToHex(r.bytes());
        if (parent) span.parentSpanId = parent;
        break;
      }
      case 5:
        span.name = r.string();
        break;
      case 6:
        span.kind = Number(r.varint());
        break;
      case 7:
        span.startTimeUnixNano = r.fixed64().toString();
        break;
      case 8:
        span.endTimeUnixNano = r.fixed64().toString();
        break;
      case 9:
        parseKeyValues(r.bytes(), attributes);
        break;
      case 11:
        events.push(parseEvent(r.bytes()));
        break;
      case 15:
        span.status = parseStatus(r.bytes());
        break;
      default:
        r.skip(wire);
    }
  }
  if (attributes.length) span.attributes = attributes;
  if (events.length) span.events = events;
  return span;
}

function parseScope(buf: Uint8Array): Record<string, unknown> {
  const r = new Reader(buf);
  const scope: Record<string, unknown> = {};
  const attributes: Record<string, unknown>[] = [];
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) scope.name = r.string();
    else if (field === 2) scope.version = r.string();
    else if (field === 3) parseKeyValues(r.bytes(), attributes);
    else r.skip(wire);
  }
  if (attributes.length) scope.attributes = attributes;
  return scope;
}

function parseScopeSpans(buf: Uint8Array): Record<string, unknown> {
  const r = new Reader(buf);
  const out: Record<string, unknown> = {};
  const spans: Record<string, unknown>[] = [];
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) out.scope = parseScope(r.bytes());
    else if (field === 2) spans.push(parseSpan(r.bytes()));
    else r.skip(wire);
  }
  out.spans = spans;
  return out;
}

function parseResource(buf: Uint8Array): Record<string, unknown> {
  const attributes: Record<string, unknown>[] = [];
  const r = new Reader(buf);
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) parseKeyValues(r.bytes(), attributes);
    else r.skip(wire);
  }
  return { attributes };
}

function parseResourceSpans(buf: Uint8Array): Record<string, unknown> {
  const r = new Reader(buf);
  const out: Record<string, unknown> = {};
  const scopeSpans: Record<string, unknown>[] = [];
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) out.resource = parseResource(r.bytes());
    else if (field === 2) scopeSpans.push(parseScopeSpans(r.bytes()));
    else r.skip(wire);
  }
  out.scopeSpans = scopeSpans;
  return out;
}

/** Decode an OTLP/protobuf body into the JSON `ExportTraceServiceRequest` shape. */
export function decodeProtobufTraces(body: Uint8Array): ExportTraceServiceRequest {
  const r = new Reader(body);
  const resourceSpans: Record<string, unknown>[] = [];
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) resourceSpans.push(parseResourceSpans(r.bytes()));
    else r.skip(wire);
  }
  return { resourceSpans } as ExportTraceServiceRequest;
}

// ---------------------------------------------------------------------------
// Writer (inverse — used by tests and the protobuf-ingest e2e path)
// ---------------------------------------------------------------------------

class Writer {
  private readonly out: number[] = [];

  private push(byte: number): void {
    this.out.push(byte & 0xff);
  }

  varint(value: bigint): void {
    let v = value;
    while (v > 0x7fn) {
      this.push(Number(v & 0x7fn) | 0x80);
      v >>= 7n;
    }
    this.push(Number(v));
  }

  tag(field: number, wire: number): void {
    this.varint(BigInt((field << 3) | wire));
  }

  fixed64(value: bigint): void {
    for (let i = 0; i < 8; i++) this.push(Number((value >> BigInt(8 * i)) & 0xffn));
  }

  double(value: number): void {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    for (const b of new Uint8Array(buf)) this.push(b);
  }

  bytes(field: number, value: Uint8Array): void {
    this.tag(field, LEN);
    this.varint(BigInt(value.length));
    for (const b of value) this.push(b);
  }

  string(field: number, value: string): void {
    this.bytes(field, textEncoder.encode(value));
  }

  message(field: number, value: Uint8Array): void {
    this.bytes(field, value);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.out);
  }
}

function hexToBytes(hex: string | undefined): Uint8Array {
  if (!hex) return new Uint8Array(0);
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

interface JsonAnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string | number;
  doubleValue?: number;
  arrayValue?: { values?: JsonAnyValue[] };
  kvlistValue?: { values?: JsonKeyValue[] };
  bytesValue?: string;
}
interface JsonKeyValue {
  key?: string;
  value?: JsonAnyValue;
}

function encodeAnyValue(v: JsonAnyValue): Uint8Array {
  const w = new Writer();
  if (v.stringValue !== undefined) w.string(1, v.stringValue);
  if (v.boolValue !== undefined) {
    w.tag(2, VARINT);
    w.varint(v.boolValue ? 1n : 0n);
  }
  if (v.intValue !== undefined) {
    w.tag(3, VARINT);
    w.varint(BigInt(v.intValue));
  }
  if (v.doubleValue !== undefined) {
    w.tag(4, I64);
    w.double(v.doubleValue);
  }
  if (v.arrayValue) {
    const inner = new Writer();
    for (const item of v.arrayValue.values ?? []) inner.message(1, encodeAnyValue(item));
    w.message(5, inner.finish());
  }
  if (v.kvlistValue) {
    const inner = new Writer();
    for (const kv of v.kvlistValue.values ?? []) inner.message(1, encodeKeyValue(kv));
    w.message(6, inner.finish());
  }
  if (v.bytesValue !== undefined) w.bytes(7, hexToBytes(v.bytesValue));
  return w.finish();
}

function encodeKeyValue(kv: JsonKeyValue): Uint8Array {
  const w = new Writer();
  if (kv.key !== undefined) w.string(1, kv.key);
  if (kv.value) w.message(2, encodeAnyValue(kv.value));
  return w.finish();
}

interface JsonSpan {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  kind?: number;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  attributes?: JsonKeyValue[];
  status?: { code?: number; message?: string };
}

function encodeSpan(span: JsonSpan): Uint8Array {
  const w = new Writer();
  if (span.traceId) w.bytes(1, hexToBytes(span.traceId));
  if (span.spanId) w.bytes(2, hexToBytes(span.spanId));
  if (span.parentSpanId) w.bytes(4, hexToBytes(span.parentSpanId));
  if (span.name !== undefined) w.string(5, span.name);
  if (span.kind !== undefined) {
    w.tag(6, VARINT);
    w.varint(BigInt(span.kind));
  }
  if (span.startTimeUnixNano !== undefined) {
    w.tag(7, I64);
    w.fixed64(BigInt(span.startTimeUnixNano));
  }
  if (span.endTimeUnixNano !== undefined) {
    w.tag(8, I64);
    w.fixed64(BigInt(span.endTimeUnixNano));
  }
  for (const attr of span.attributes ?? []) w.message(9, encodeKeyValue(attr));
  if (span.status) {
    const s = new Writer();
    if (span.status.message !== undefined) s.string(2, span.status.message);
    if (span.status.code !== undefined) {
      s.tag(3, VARINT);
      s.varint(BigInt(span.status.code));
    }
    w.message(15, s.finish());
  }
  return w.finish();
}

/**
 * Encode a JSON `ExportTraceServiceRequest` (hex ids, string nanos) into
 * OTLP/protobuf bytes. The inverse of {@link decodeProtobufTraces}.
 */
export function encodeProtobufTraces(request: ExportTraceServiceRequest): Uint8Array {
  const top = new Writer();
  for (const rs of request.resourceSpans ?? []) {
    const rsw = new Writer();
    if (rs.resource) {
      const res = new Writer();
      for (const attr of rs.resource.attributes ?? []) res.message(1, encodeKeyValue(attr));
      rsw.message(1, res.finish());
    }
    for (const ss of rs.scopeSpans ?? []) {
      const ssw = new Writer();
      if (ss.scope) {
        const scope = new Writer();
        if (ss.scope.name !== undefined) scope.string(1, ss.scope.name);
        if (ss.scope.version !== undefined) scope.string(2, ss.scope.version);
        ssw.message(1, scope.finish());
      }
      for (const span of ss.spans ?? []) ssw.message(2, encodeSpan(span as JsonSpan));
      rsw.message(2, ssw.finish());
    }
    top.message(1, rsw.finish());
  }
  return top.finish();
}
