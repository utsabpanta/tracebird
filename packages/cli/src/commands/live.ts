import { createServer, listen } from '../server.js';
import { RawSpanWriter } from '../storage/raw-writer.js';

export interface LiveOptions {
  port: number;
  host: string;
  outDir: string;
  open: boolean;
}

/**
 * `tracebird live` — start the OTLP receiver and capture spans to a `.jsonl`
 * session file. (Stage 1: capture only. Stage 2 reconstructs runs; Stage 3
 * serves the UI and opens the browser.)
 */
export async function runLive(options: LiveOptions): Promise<void> {
  const writer = new RawSpanWriter(options.outDir, `capture-${Date.now()}.jsonl`);

  const server = createServer({
    onExport: (spans) => {
      writer.append(spans);
      if (spans.length > 0) {
        process.stdout.write(
          `  ← captured ${spans.length} span(s)  (total ${writer.written})\n`,
        );
      }
    },
  });

  const boundPort = await listen(server, options.port, options.host);
  const endpoint = `http://${options.host}:${boundPort}`;

  process.stdout.write(
    [
      '',
      '  tracebird — listening for OpenTelemetry traces',
      '',
      `  OTLP endpoint   ${endpoint}/v1/traces`,
      `  Session file    ${writer.filePath}`,
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
      server.close(() => {
        void writer.close().then(() => resolveShutdown());
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
