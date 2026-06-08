# tracebird

> **A local-first, time-travel debugger for AI agent runs.**
> "Redux DevTools for AI agents." Point it at any OpenTelemetry-emitting agent,
> step through the run locally, diff two runs to see what changed.
> No cloud, no account.

AI agents fail silently — a confident, wrong answer with no crash and no stack
trace. tracebird captures the OpenTelemetry GenAI spans your agent already
emits, reconstructs them into an inspectable decision tree, and lets you step
through and diff runs locally.

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

> _Screenshot coming with the UI in Stage 3._

## How it works

```
your agent ──OTLP/HTTP──▶ @tracebird/cli ──▶ @tracebird/core ──▶ @tracebird/ui
 (instrumented)            receiver + UI       span → run tree     inspect + diff
```

- **`@tracebird/core`** — pure span → agent-tree reconstruction. No I/O.
- **`@tracebird/cli`** — the `npx` entrypoint: OTLP receiver + static UI server.
- **`@tracebird/ui`** — React app: run list, execution tree, inspector, diff, scrubber.

## v1 scope

Read-only forensics on a completed run. See [`ROADMAP.md`](./ROADMAP.md) for
what's intentionally **not** in v1 (replay, cloud sync, auth, eval scoring,
gRPC, SQLite, …).

## Develop

This is an [Nx](https://nx.dev) + [pnpm](https://pnpm.io) integrated monorepo.

```sh
pnpm install
npx nx run-many -t build test lint     # the full gate
npx nx test core                       # one project
```

| Package | Path | Description |
| --- | --- | --- |
| `@tracebird/core` | `packages/core` | Span ingest + tree reconstruction (pure). |
| `@tracebird/cli` | `packages/cli` | OTLP receiver, session storage, UI server. |
| `@tracebird/ui` | `packages/ui` | React/Vite front-end. |
| `@tracebird/fixtures` | `libs/fixtures` | Sample OTLP payloads + recorded sessions. |

## License

MIT
