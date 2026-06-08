import { join } from 'node:path';
import { buildRun } from '@tracebird/core';
import { createServer, listen } from '../server.js';
import { SessionStore } from '../storage/session-store.js';
import { TraceBuffer } from '../trace-buffer.js';
import { renderRunTree } from '../render/tree.js';

export interface LiveOptions {
  port: number;
  host: string;
  outDir: string;
  open: boolean;
}

/**
 * `tracebird live` — start the OTLP receiver, buffer spans per trace, and on
 * each completed trace reconstruct a run, print its decision tree, and append
 * it to the session file. (Stage 3 serves the UI and opens the browser.)
 */
export async function runLive(options: LiveOptions): Promise<void> {
  const store = new SessionStore(join(options.outDir, `session-${Date.now()}.jsonl`));

  const buffer = new TraceBuffer({
    onComplete: (_traceId, spans) => {
      const run = buildRun(spans);
      store.addRun(run);
      process.stdout.write('\n' + renderRunTree(run) + '\n');
    },
  });

  const server = createServer({ onExport: (spans) => buffer.add(spans) });
  const boundPort = await listen(server, options.port, options.host);
  const endpoint = `http://${options.host}:${boundPort}`;

  process.stdout.write(
    [
      '',
      '  tracebird — listening for OpenTelemetry traces',
      '',
      `  OTLP endpoint   ${endpoint}/v1/traces`,
      `  Session file    ${store.filePath}`,
      '',
      '  Point your agent at this receiver:',
      `    export OTEL_EXPORTER_OTLP_ENDPOINT=${endpoint}`,
      '',
      '  Waiting for your first agent run…  (Ctrl-C to stop)',
      '',
    ].join('\n') + '\n',
  );

  await new Promise<void>((resolveShutdown) => {
    const shutdown = () => {
      process.stdout.write('\n  Stopping…\n');
      buffer.flushAll();
      server.close(() => {
        void store.close().then(() => resolveShutdown());
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
