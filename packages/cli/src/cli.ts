import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { runLive } from './commands/live.js';
import { runOpen } from './commands/open.js';

const HELP = `tracebird — a local-first, time-travel debugger for AI agent runs.

Usage:
  tracebird [live]                 Start the OTLP receiver + UI (default).
  tracebird open <file.jsonl>      Load a saved session and serve the UI.
  tracebird --help                 Show this help.

Options:
  --port <n>     Port for the OTLP receiver / UI server (default 4318).
  --host <addr>  Address to bind (default 127.0.0.1).
  --out <dir>    Directory for captured sessions (default ./.tracebird).
  --no-open      Do not open the browser on start.

Point your agent's OpenTelemetry exporter at the receiver:
  export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
`;

async function main(argv: string[]): Promise<void> {
  // Node's parseArgs has no built-in negation; handle --no-open ourselves.
  const noOpen = argv.includes('--no-open');
  const cleaned = argv.filter((a) => a !== '--no-open');

  const { values, positionals } = parseArgs({
    args: cleaned,
    allowPositionals: true,
    options: {
      port: { type: 'string' },
      host: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  const command = positionals[0] ?? 'live';
  const port = values.port ? Number(values.port) : 4318;
  const host = values.host ?? '127.0.0.1';
  const outDir = resolve(values.out ?? '.tracebird');
  const open = !noOpen;

  switch (command) {
    case 'live':
      await runLive({ port, host, outDir, open });
      break;
    case 'open': {
      const file = positionals[1];
      if (!file) {
        process.stderr.write('Usage: tracebird open <file.jsonl>\n');
        process.exitCode = 1;
        break;
      }
      await runOpen({ file, port, host, open });
      break;
    }
    case 'help':
      process.stdout.write(HELP);
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`tracebird: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
