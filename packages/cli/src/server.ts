import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { parseOtlp, type ExportTraceServiceRequest, type Span } from '@tracebird/core';
import { decodeProtobufTraces } from './otlp/protobuf.js';

/** Called whenever a batch of spans is received and parsed. */
export type ExportHandler = (spans: Span[], raw: ExportTraceServiceRequest) => void | Promise<void>;

export interface ServerOptions {
  /** Invoked with the parsed spans for every accepted OTLP export. */
  onExport?: ExportHandler;
  /**
   * Optional extra request handler tried before the 404 fallback — used by the
   * UI/API layer in later stages. Return `true` if it handled the request.
   */
  extraHandler?: (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>;
}

const MAX_BODY_BYTES = 50 * 1024 * 1024; // 50 MB — generous for batched exports.

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function decodeExport(contentType: string, body: Buffer): ExportTraceServiceRequest {
  if (contentType.includes('application/x-protobuf') || contentType.includes('application/protobuf')) {
    return decodeProtobufTraces(body);
  }
  // Default to JSON (the OTLP/HTTP JSON content type, or anything unspecified).
  const text = body.toString('utf8').trim();
  return text ? (JSON.parse(text) as ExportTraceServiceRequest) : {};
}

function sendProtobuf(res: ServerResponse, status: number): void {
  // An empty ExportTraceServiceResponse encodes to zero bytes (full success).
  res.writeHead(status, { 'content-type': 'application/x-protobuf' });
  res.end();
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function handleTraces(
  req: IncomingMessage,
  res: ServerResponse,
  onExport?: ExportHandler,
): Promise<void> {
  const contentType = req.headers['content-type'] ?? 'application/json';
  let body: Buffer;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 413, { error: 'payload too large' });
    return;
  }

  let request: ExportTraceServiceRequest;
  try {
    request = decodeExport(contentType, body);
  } catch (err) {
    sendJson(res, 400, { error: `failed to decode OTLP payload: ${(err as Error).message}` });
    return;
  }

  const spans = parseOtlp(request);
  try {
    await onExport?.(spans, request);
  } catch (err) {
    sendJson(res, 500, { error: `export handler failed: ${(err as Error).message}` });
    return;
  }

  const isProtobuf =
    contentType.includes('application/x-protobuf') || contentType.includes('application/protobuf');
  if (isProtobuf) sendProtobuf(res, 200);
  else sendJson(res, 200, {});
}

/** Create the tracebird HTTP server (OTLP receiver + optional extra routes). */
export function createServer(options: ServerOptions = {}): Server {
  return createHttpServer((req, res) => {
    void (async () => {
      const url = (req.url ?? '/').split('?')[0];

      if (req.method === 'POST' && url === '/v1/traces') {
        await handleTraces(req, res, options.onExport);
        return;
      }

      if (req.method === 'GET' && (url === '/health' || url === '/healthz')) {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (options.extraHandler) {
        const handled = await options.extraHandler(req, res);
        if (handled) return;
      }

      sendJson(res, 404, { error: 'not found' });
    })().catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: (err as Error).message });
    });
  });
}

/** Start a server and resolve once it is listening, with the bound port. */
export function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve(boundPort);
    });
  });
}
