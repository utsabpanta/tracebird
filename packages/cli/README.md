# @tracebird/cli

The public face of [tracebird](../../README.md). A single `npx` away from a
local, time-travel debugger for your AI agent runs.

```sh
npx @tracebird/cli           # start the OTLP receiver (+ UI, from Stage 3)
```

Then point any OpenTelemetry-instrumented agent at it:

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Commands

| Command | Description |
| --- | --- |
| `tracebird` / `tracebird live` | Start the OTLP receiver and capture spans. |
| `tracebird open <file.jsonl>` | Load a saved session and serve the UI _(Stage 3)_. |

## Options

| Flag | Default | Description |
| --- | --- | --- |
| `--port <n>` | `4318` | Port for the receiver / UI server. |
| `--host <addr>` | `127.0.0.1` | Address to bind. |
| `--out <dir>` | `./.tracebird` | Where captured sessions are written. |
| `--no-open` | — | Don't open the browser on start. |

## How it works

- A tiny `node:http` server accepts `POST /v1/traces` in both OTLP/JSON and
  OTLP/protobuf (the SDK default). Protobuf is decoded with a vendored
  descriptor — no codegen step.
- Parsing and reconstruction are delegated entirely to
  [`@tracebird/core`](../core/README.md); the CLI only does I/O.
```sh
npx nx test cli
```
