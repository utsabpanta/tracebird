import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { weatherHappyPath } from '@tracebird/fixtures';

const CLI = fileURLToPath(new URL('../../../packages/cli/dist/cli.js', import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await fn()) return;
    } catch {
      // keep polling
    }
    await sleep(150);
  }
  throw new Error('condition not met within timeout');
}

describe('e2e: capture → reconstruct → serve', () => {
  let child: ChildProcess;
  let base: string;
  let outDir: string;

  beforeAll(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    outDir = mkdtempSync(join(tmpdir(), 'tb-e2e-'));
    child = spawn(
      'node',
      [CLI, 'live', '--port', String(port), '--host', '127.0.0.1', '--no-open', '--out', outDir],
      {
        stdio: 'ignore',
      },
    );
    await waitFor(async () => (await fetch(`${base}/health`)).ok, 15000);
  });

  afterAll(() => {
    child?.kill('SIGTERM');
    if (outDir) rmSync(outDir, { recursive: true, force: true });
  });

  it('serves the reconstructed tree for a posted OTLP fixture', async () => {
    const post = await fetch(`${base}/v1/traces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(weatherHappyPath),
    });
    expect(post.status).toBe(200);

    // The trace flushes after the idle window; wait for it to surface via the API.
    await waitFor(async () => {
      const runs = (await (await fetch(`${base}/api/runs`)).json()) as unknown[];
      return runs.length >= 1;
    }, 10000);

    const runs = (await (await fetch(`${base}/api/runs`)).json()) as {
      id: string;
      summary: string;
      tokens: { total?: number };
    }[];
    expect(runs).toHaveLength(1);
    expect(runs[0].summary).toContain('weather-assistant');
    expect(runs[0].tokens.total).toBe(274);

    const run = (await (
      await fetch(`${base}/api/runs/${encodeURIComponent(runs[0].id)}`)
    ).json()) as {
      root: { kind: string; children: { kind: string; children: { kind: string }[] }[] };
    };
    expect(run.root.kind).toBe('run');
    const agent = run.root.children[0];
    expect(agent.kind).toBe('agent');
    expect(agent.children.map((c) => c.kind)).toEqual(['llm', 'tool', 'tool', 'llm']);
  });
});
