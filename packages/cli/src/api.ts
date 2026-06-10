import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { diffRuns, type Run } from '@tracebird/core';
import type { SessionStore } from './storage/session-store.js';
import { buildHtmlSnapshot, exportJsonl } from './export.js';

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
  /** Directory of the built UI assets (needed for HTML snapshot export). */
  uiDir?: string;
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
    const params = new URL(req.url ?? '', 'http://localhost').searchParams;
    const query = params.get('q') ?? undefined;
    const statusParam = params.get('status');
    const status =
      statusParam === 'ok' || statusParam === 'error' || statusParam === 'unset'
        ? statusParam
        : 'all';
    json(res, 200, ctx.store.list({ query, status }));
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

  if (url === '/api/export') {
    const params = new URL(req.url ?? '', 'http://localhost').searchParams;
    const id = params.get('id');
    const format = params.get('format') === 'jsonl' ? 'jsonl' : 'html';

    let runs: Run[];
    let name: string;
    if (id) {
      const run = ctx.store.get(id);
      if (!run) {
        json(res, 404, { error: `run not found: ${id}` });
        return true;
      }
      runs = [run];
      name = `tracebird-run-${run.traceId.slice(0, 8) || 'export'}`;
    } else {
      runs = ctx.store.all();
      name = 'tracebird-session';
    }

    if (format === 'jsonl') {
      res.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'content-disposition': `attachment; filename="${name}.jsonl"`,
      });
      res.end(exportJsonl(runs));
      return true;
    }

    if (!ctx.uiDir || !existsSync(join(ctx.uiDir, 'index.html'))) {
      json(res, 503, { error: 'UI assets not available for HTML export' });
      return true;
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `attachment; filename="${name}.html"`,
    });
    res.end(buildHtmlSnapshot(ctx.uiDir, runs));
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
