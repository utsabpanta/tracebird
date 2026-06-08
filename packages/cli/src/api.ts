import type { IncomingMessage, ServerResponse } from 'node:http';
import { diffRuns } from '@tracebird/core';
import type { SessionStore } from './storage/session-store.js';

/**
 * The JSON API the UI reads. Pure delegation to the {@link SessionStore} (which
 * delegates reconstruction/diff to `@tracebird/core`); no business logic here.
 *
 *   GET /api/session        → { live, filePath, count }
 *   GET /api/runs           → RunSummary[]
 *   GET /api/runs/:id       → Run
 */

export interface ApiContext {
  store: SessionStore;
  live: boolean;
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}

/** Handle an `/api/*` request. Returns false if the path isn't an API route. */
export function handleApi(ctx: ApiContext, req: IncomingMessage, res: ServerResponse): boolean {
  const url = (req.url ?? '/').split('?')[0];
  if (!url.startsWith('/api/')) return false;

  if (req.method !== 'GET') {
    json(res, 405, { error: 'method not allowed' });
    return true;
  }

  if (url === '/api/session') {
    json(res, 200, {
      live: ctx.live,
      filePath: ctx.store.filePath ?? null,
      count: ctx.store.size,
    });
    return true;
  }

  if (url === '/api/runs') {
    json(res, 200, ctx.store.list());
    return true;
  }

  if (url === '/api/diff') {
    const params = new URL(req.url ?? '', 'http://localhost').searchParams;
    const aId = params.get('a');
    const bId = params.get('b');
    if (!aId || !bId) {
      json(res, 400, { error: 'diff requires ?a=<runId>&b=<runId>' });
      return true;
    }
    const a = ctx.store.get(aId);
    const b = ctx.store.get(bId);
    if (!a || !b) {
      json(res, 404, { error: `run not found: ${!a ? aId : bId}` });
      return true;
    }
    json(res, 200, diffRuns(a, b));
    return true;
  }

  const match = /^\/api\/runs\/([^/]+)$/.exec(url);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const run = ctx.store.get(id);
    if (!run) json(res, 404, { error: `run not found: ${id}` });
    else json(res, 200, run);
    return true;
  }

  json(res, 404, { error: 'unknown api route' });
  return true;
}
