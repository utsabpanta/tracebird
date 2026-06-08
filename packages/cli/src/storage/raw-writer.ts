import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import type { Span } from '@tracebird/core';

/**
 * Stage-1 persistence: append captured spans to a `.jsonl` file, one span per
 * line. Stage 2 layers run-reconstruction on top; this stays as the raw capture.
 */
export class RawSpanWriter {
  private stream: WriteStream;
  readonly filePath: string;
  private count = 0;

  constructor(outDir: string, fileName: string) {
    mkdirSync(outDir, { recursive: true });
    this.filePath = join(outDir, fileName);
    this.stream = createWriteStream(this.filePath, { flags: 'a' });
  }

  append(spans: Span[]): void {
    for (const span of spans) {
      this.stream.write(JSON.stringify(span) + '\n');
      this.count += 1;
    }
  }

  get written(): number {
    return this.count;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}
