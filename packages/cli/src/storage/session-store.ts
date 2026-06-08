import { createWriteStream, mkdirSync, readFileSync, type WriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { parseSession, serializeRun, StatusCode, type Run, type TraceNode } from '@tracebird/core';

/** Lightweight run summary for list views (no heavy prompt/completion payloads). */
export interface RunSummary {
  id: string;
  traceId: string;
  summary: string;
  startTimeUnixNano: string;
  durationMs: number;
  status: 'ok' | 'error' | 'unset';
  tokens: Run['tokens'];
  costUsd: number | null;
  service?: string;
  nodeCount: number;
}

function statusLabel(code: StatusCode): RunSummary['status'] {
  if (code === StatusCode.Error) return 'error';
  if (code === StatusCode.Ok) return 'ok';
  return 'unset';
}

function countNodes(node: TraceNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

/**
 * Holds the runs for one session in memory and (optionally) appends them to a
 * `.jsonl` file. Backs both `live` capture (append mode) and `open` (read-only).
 */
export class SessionStore {
  private readonly runs: Run[] = [];
  private readonly byId = new Map<string, Run>();
  private stream?: WriteStream;
  readonly filePath?: string;

  constructor(filePath?: string) {
    if (filePath) {
      mkdirSync(dirname(filePath), { recursive: true });
      this.filePath = filePath;
      this.stream = createWriteStream(filePath, { flags: 'a' });
    }
  }

  /** Load an existing session file read-only (for `tracebird open`). */
  static load(filePath: string): SessionStore {
    const store = new SessionStore();
    const text = readFileSync(filePath, 'utf8');
    for (const run of parseSession(text)) store.addRun(run, { persist: false });
    return store;
  }

  addRun(run: Run, options: { persist?: boolean } = {}): void {
    this.runs.push(run);
    this.byId.set(run.id, run);
    if (options.persist !== false) this.stream?.write(serializeRun(run) + '\n');
  }

  get(id: string): Run | undefined {
    return this.byId.get(id);
  }

  all(): Run[] {
    return this.runs;
  }

  /** Run summaries, newest first. */
  list(): RunSummary[] {
    return this.runs
      .map((run) => ({
        id: run.id,
        traceId: run.traceId,
        summary: run.summary,
        startTimeUnixNano: run.startTimeUnixNano,
        durationMs: run.durationMs,
        status: statusLabel(run.status.code),
        tokens: run.tokens,
        costUsd: run.costUsd,
        ...(run.service ? { service: run.service } : {}),
        nodeCount: countNodes(run.root),
      }))
      .sort((a, b) => (a.startTimeUnixNano < b.startTimeUnixNano ? 1 : -1));
  }

  get size(): number {
    return this.runs.length;
  }

  async close(): Promise<void> {
    const stream = this.stream;
    if (!stream) return;
    await new Promise<void>((resolve, reject) => {
      stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}
