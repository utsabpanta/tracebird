import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi, type ApiContext } from './api.js';
import { serveStatic } from './static-files.js';
import type { SseHub } from './sse.js';

/**
 * Build the combined UI/API request handler passed to the server as its
 * `extraHandler`: the SSE stream and API routes first, then the static UI
 * (with SPA fallback).
 */
export function createAppHandler(ctx: ApiContext, uiDir: string, sse?: SseHub) {
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const url = (req.url ?? '/').split('?')[0];
    if (sse && req.method === 'GET' && url === '/api/stream') {
      sse.handle(req, res);
      return true;
    }
    if (handleApi(ctx, req, res)) return true;
    if (serveStatic(uiDir, req, res)) return true;
    return false;
  };
}
