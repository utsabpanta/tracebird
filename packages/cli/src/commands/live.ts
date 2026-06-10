import { join } from 'node:path';
import { buildRun } from '@tracebird/core';
import { createServer, listen } from '../server.js';
import { SessionStore } from '../storage/session-store.js';
import { TraceBuffer } from '../trace-buffer.js';
import { renderRunTree } from '../render/tree.js';
import { createAppHandler } from '../app.js';
import { resolveUiDir } from '../ui-dir.js';
import { openBrowser } from '../open-browser.js';
import { SseHub } from '../sse.js';

export interface LiveOptions {
  port: number;
  host: string;
  outDir: string;
  open: boolean;
}

/**
 * `tracebird live` — start the OTLP receiver, reconstruct each completed trace,
 * print its tree, persist it, and serve the UI (which polls the JSON API).
 */
export async function runLive(options: LiveOptions): Promise<void> {
  const store = new SessionStore(join(options.outDir, `session-${Date.now()}.jsonl`));
  const sse = new SseHub();

  const buffer = new TraceBuffer({
    onComplete: (_traceId, spans) => {
      const run = buildRun(spans);
      store.addRun(run);
      process.stdout.write('\n' + renderRunTree(run) + '\n');
      sse.broadcast('run', { id: run.id });
    },
  });

  const server = createServer({
    onExport: (spans) => {
      buffer.add(spans);
      sse.broadcast('activity', { spans: spans.length });
    },
    extraHandler: createAppHandler({ store, live: true }, resolveUiDir(), sse),
  });

  const boundPort = await listen(server, options.port, options.host);
  const endpoint = `http://${options.host}:${boundPort}`;

  process.stdout.write(
    [
      '',
      '  tracebird — listening for OpenTelemetry traces',
      '',
      `  UI              ${endpoint}`,
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

  if (options.open) openBrowser(endpoint);

  await new Promise<void>((resolveShutdown) => {
    const shutdown = () => {
      process.stdout.write('\n  Stopping…\n');
      buffer.flushAll();
      sse.close();
      server.close(() => {
        void store.close().then(() => resolveShutdown());
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
