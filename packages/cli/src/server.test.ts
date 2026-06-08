import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { weatherHappyPath } from '@tracebird/fixtures';
import type { Span, ExportTraceServiceRequest } from '@tracebird/core';
import { createServer } from './server.js';
import { decodeProtobufTraces, encodeProtobufTraces } from './otlp/protobuf.js';

let active: Server | undefined;

afterEach(async () => {
  const server = active;
  if (server) await new Promise<void>((r) => server.close(() => r()));
  active = undefined;
});

function boot(onExport: (spans: Span[], raw: ExportTraceServiceRequest) => void): Promise<string> {
  const server = createServer({ onExport });
  active = server;
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

describe('OTLP receiver', () => {
  it('accepts an OTLP/JSON export and parses spans', async () => {
    let captured: Span[] = [];
    const base = await boot((spans) => (captured = spans));

    const res = await fetch(`${base}/v1/traces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(weatherHappyPath),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    expect(captured).toHaveLength(5);
    expect(captured.find((s) => s.name.startsWith('invoke_agent'))).toBeDefined();
  });

  it('accepts an OTLP/protobuf export (round-trip through the decoder)', async () => {
    let captured: Span[] = [];
    const base = await boot((spans) => (captured = spans));

    const body = encodeProtobufTraces(weatherHappyPath);
    const res = await fetch(`${base}/v1/traces`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-protobuf' },
      body,
    });

    expect(res.status).toBe(200);
    expect(captured).toHaveLength(5);
    const llm = captured.find((s) => s.attributes['gen_ai.operation.name'] === 'chat');
    expect(llm?.attributes['gen_ai.request.model']).toBe('gpt-4o');
    // ids survive the bytes ↔ hex conversion
    expect(captured[0].spanId).toMatch(/^[0-9a-f]+$/);
  });

  it('round-trips ids and tokens through protobuf encode/decode', () => {
    const decoded = decodeProtobufTraces(encodeProtobufTraces(weatherHappyPath));
    const span = decoded.resourceSpans?.[0].scopeSpans?.[0].spans?.[0];
    expect(span?.spanId).toBe('1111111111111111');
    expect(span?.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
  });

  it('returns 400 on malformed JSON', async () => {
    const base = await boot(() => undefined);
    const res = await fetch(`${base}/v1/traces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
  });

  it('serves a health check and 404s unknown routes', async () => {
    const base = await boot(() => undefined);
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await fetch(`${base}/nope`)).status).toBe(404);
  });
});
