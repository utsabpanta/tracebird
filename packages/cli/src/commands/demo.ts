import { buildRuns, parseOtlp } from '@tracebird/core';
import { otlpFixtures } from '@tracebird/fixtures';
import { createServer, listen } from '../server.js';
import { SessionStore } from '../storage/session-store.js';
import { createAppHandler } from '../app.js';
import { resolveUiDir } from '../ui-dir.js';
import { openBrowser } from '../open-browser.js';

export interface DemoOptions {
  port: number;
  host: string;
  open: boolean;
}

/**
 * `tracebird demo` — serve the UI pre-loaded with the bundled sample runs
 * (a multi-tool run, a tool error, and a diff pair) so you can explore the
 * inspector, scrubber, and diff without wiring up a real agent.
 */
export async function runDemo(options: DemoOptions): Promise<void> {
  const store = new SessionStore();
  for (const payload of Object.values(otlpFixtures)) {
    for (const run of buildRuns(parseOtlp(payload))) store.addRun(run, { persist: false });
  }

  const server = createServer({
    extraHandler: createAppHandler({ store, live: false }, resolveUiDir()),
  });
  const boundPort = await listen(server, options.port, options.host);
  const endpoint = `http://${options.host}:${boundPort}`;

  process.stdout.write(
    [
      '',
      `  tracebird — demo mode, ${store.size} sample run(s) loaded`,
      '',
      `  UI   ${endpoint}`,
      '',
      '  Try the Diff tab (the two support-triage runs differ on one decision),',
      '  and drag the scrubber to time-travel through a run.',
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
