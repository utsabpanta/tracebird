import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildRun, parseOtlp } from '@tracebird/core';
import { weatherHappyPath, toolError } from '@tracebird/fixtures';
import { createServer } from './server.js';
import { SessionStore } from './storage/session-store.js';
import { createAppHandler } from './app.js';

const weatherRun = buildRun(parseOtlp(weatherHappyPath));
const errorRun = buildRun(parseOtlp(toolError));

let active: Server | undefined;
const dirs: string[] = [];
afterEach(async () => {
  const server = active;
  if (server) await new Promise<void>((r) => server.close(() => r()));
  active = undefined;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function boot(uiDir: string, live = false): Promise<string> {
  const store = new SessionStore();
  store.addRun(weatherRun, { persist: false });
  store.addRun(errorRun, { persist: false });
  const server = createServer({ extraHandler: createAppHandler({ store, live }, uiDir) });
  active = server;
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

describe('JSON API', () => {
  it('GET /api/session reports live + count', async () => {
    const base = await boot('/no/such/ui', true);
    const info = await (await fetch(`${base}/api/session`)).json();
    expect(info).toMatchObject({ live: true, count: 2 });
  });

  it('GET /api/runs returns summaries newest-first', async () => {
    const base = await boot('/no/such/ui');
    const runs = (await (await fetch(`${base}/api/runs`)).json()) as { id: string }[];
    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe(errorRun.id); // later base timestamp
  });

  it('GET /api/runs/:id returns the full run, 404 for unknown', async () => {
    const base = await boot('/no/such/ui');
    const run = await (await fetch(`${base}/api/runs/${encodeURIComponent(weatherRun.id)}`)).json();
    expect(run).toEqual(weatherRun);
    expect((await fetch(`${base}/api/runs/missing`)).status).toBe(404);
  });

  it('405s non-GET API methods', async () => {
    const base = await boot('/no/such/ui');
    const res = await fetch(`${base}/api/runs`, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});

describe('static UI serving', () => {
  it('serves index.html and falls back to it for SPA routes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tb-ui-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>tracebird</title>');
    const base = await boot(dir);

    const root = await fetch(`${base}/`);
    expect(root.headers.get('content-type')).toContain('text/html');
    expect(await root.text()).toContain('tracebird');

    // unknown client-side route → index.html fallback (200, not 404)
    const spa = await fetch(`${base}/runs/whatever`);
    expect(spa.status).toBe(200);
  });
});
