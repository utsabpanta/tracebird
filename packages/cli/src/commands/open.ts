import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, listen } from '../server.js';
import { SessionStore } from '../storage/session-store.js';
import { createAppHandler } from '../app.js';
import { resolveUiDir } from '../ui-dir.js';
import { openBrowser } from '../open-browser.js';

export interface OpenOptions {
  file: string;
  port: number;
  host: string;
  open: boolean;
}

/**
 * `tracebird open <file.jsonl>` — load a saved session and serve the UI with no
 * receiver. The "drag a run to a coworker" loop.
 */
export async function runOpen(options: OpenOptions): Promise<void> {
  const file = resolve(options.file);
  if (!existsSync(file)) {
    process.stderr.write(`tracebird: session file not found: ${file}\n`);
    process.exitCode = 1;
    return;
  }

  let store: SessionStore;
  try {
    store = SessionStore.load(file);
  } catch (err) {
    process.stderr.write(`tracebird: failed to load session: ${(err as Error).message}\n`);
    process.exitCode = 1;
    return;
  }

  const server = createServer({
    extraHandler: createAppHandler({ store, live: false }, resolveUiDir()),
  });

  const boundPort = await listen(server, options.port, options.host);
  const endpoint = `http://${options.host}:${boundPort}`;

  process.stdout.write(
    [
      '',
      `  tracebird — serving ${store.size} run(s) from`,
      `    ${file}`,
      '',
      `  UI   ${endpoint}`,
      '',
      '  (Ctrl-C to stop)',
      '',
    ].join('\n') + '\n',
  );

  if (options.open) openBrowser(endpoint);

  await new Promise<void>((resolveShutdown) => {
    const shutdown = () => {
      process.stdout.write('\n  Stopping…\n');
      server.close(() => resolveShutdown());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
