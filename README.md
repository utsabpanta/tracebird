# tracebird

> **A local-first, time-travel debugger for AI agent runs.**
> "Redux DevTools for AI agents." Point it at any OpenTelemetry-emitting agent,
> step through the run locally, diff two runs to see what changed.
> No cloud, no account.

AI agents fail silently — a confident, wrong answer with no crash and no stack
trace. tracebird captures the OpenTelemetry GenAI spans your agent already
emits, reconstructs them into an inspectable decision tree, and lets you step
through and diff runs locally.

![tracebird inspecting an agent run](docs/screenshot.png)

## Quickstart

```sh
npx @tracebird/cli
```

Then point your agent's OpenTelemetry exporter at the local receiver and run it:

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

That's the whole integration — **zero code changes** to your agent. tracebird
accepts OTLP/HTTP in both JSON and protobuf (the SDK default).

Have a saved session from a coworker? Replay it with no receiver:

```sh
npx @tracebird/cli open ./session.jsonl
```

## Features

- **Execution tree** — flat spans reconstructed into run → agent → LLM/tool.
- **Inspector** — prompt, completion, tool args/result, tokens, cost, model, timing.
- **Time-travel scrubber** — drag through the run; the selection follows time.
- **Diff** — pick two runs; see the structural + word-level text diff ("worked yesterday").
- **Terminal tree** — `live` prints each reconstructed run as it arrives.

## How it works

```
your agent ──OTLP/HTTP──▶ @tracebird/cli ──▶ @tracebird/core ──▶ @tracebird/ui
 (instrumented)            receiver + UI       span → run tree     inspect + diff
```

- **`@tracebird/core`** — pure span → agent-tree reconstruction. No I/O.
- **`@tracebird/cli`** — the `npx` entrypoint: OTLP receiver + static UI server.
- **`@tracebird/ui`** — React app: run list, execution tree, inspector, diff, scrubber.

## v1 scope

Read-only forensics on a completed run. **Not yet** (see [`ROADMAP.md`](./ROADMAP.md)):
replay-execution, cloud sync / hosted version, auth / multi-user, eval scoring,
multi-agent topology graphs, gRPC ingest, SQLite persistence, VS Code extension.

## Develop

This is an [Nx](https://nx.dev) + [pnpm](https://pnpm.io) integrated monorepo.

```sh
pnpm install
npx nx run-many -t build test lint     # the full gate
npx nx run smoke:e2e                    # end-to-end against the built CLI
npx nx test core                       # one project
npx nx dev ui                          # UI dev server (proxies /api to :4318)
```

Releases are managed with [changesets](https://github.com/changesets/changesets);
CI (`.github/workflows`) runs build + test + lint + e2e on every PR.

| Package | Path | Description |
| --- | --- | --- |
| `@tracebird/core` | `packages/core` | Span ingest + tree reconstruction (pure). |
| `@tracebird/cli` | `packages/cli` | OTLP receiver, session storage, UI server. |
| `@tracebird/ui` | `packages/ui` | React/Vite front-end. |
| `@tracebird/fixtures` | `libs/fixtures` | Sample OTLP payloads + recorded sessions. |

## License

MIT
