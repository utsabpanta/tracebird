import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRun, parseOtlp } from '@tracebird/core';
import { weatherHappyPath, toolError } from '@tracebird/fixtures';
import { SessionStore } from './session-store.js';

const weatherRun = buildRun(parseOtlp(weatherHappyPath));
const errorRun = buildRun(parseOtlp(toolError));

const dirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tb-store-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('SessionStore', () => {
  it('lists summaries newest-first and fetches by id', () => {
    const store = new SessionStore();
    store.addRun(errorRun, { persist: false });
    store.addRun(weatherRun, { persist: false });

    const list = store.list();
    expect(list).toHaveLength(2);
    // the tool-error fixture has the later base timestamp → newest first
    expect(list[0].traceId).toBe(errorRun.traceId);
    expect(list[0].status).toBe('error');
    expect(list[0].nodeCount).toBeGreaterThan(0);
    expect(list.map((r) => r.traceId)).toContain(weatherRun.traceId);

    expect(store.get(weatherRun.id)?.summary).toBe(weatherRun.summary);
    expect(store.get('missing')).toBeUndefined();
  });

  it('persists runs to jsonl and reloads them', async () => {
    const file = join(tmp(), 'session.jsonl');
    const store = new SessionStore(file);
    store.addRun(weatherRun);
    store.addRun(errorRun);
    await store.close();

    const reloaded = SessionStore.load(file);
    expect(reloaded.size).toBe(2);
    expect(reloaded.get(weatherRun.id)).toEqual(weatherRun);
    expect(reloaded.filePath).toBeUndefined(); // loaded read-only
  });
});
