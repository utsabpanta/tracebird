# @tracebird/core

The technical heart of [tracebird](../../README.md): turns flat OpenTelemetry
GenAI spans into an inspectable agent-decision tree.

**Pure TypeScript — no filesystem, no network.** Everything here is a pure
function, which makes it trivial to unit-test against recorded fixtures.

## Exports

| Function | What it does |
| --- | --- |
| `parseOtlp(request)` | Parse an OTLP `ExportTraceServiceRequest` into a flat `Span[]`. |
| `buildRun(spans)` | _(Stage 2)_ Reconstruct spans into a `Run` tree. |
| `serializeRun` / `parseRun` | _(Stage 2)_ `Run` ↔ `.jsonl` session line. |
| `diffRuns` / `diffCalls` | _(Stage 4)_ Structural + text diff of two runs/calls. |

Plus the full type model: `Run`, `TraceNode`, `LlmCall`, `ToolCall`, `Span`, …

## Design notes

- **Timestamps are strings.** OTLP unix-nanos exceed `Number.MAX_SAFE_INTEGER`,
  so they're kept as their raw uint64 strings; use `durationMs` / `compareNano`.
- **Defensive by default.** The GenAI span conventions are experimental — unknown
  operations degrade to a generic node and orphan spans attach to a synthetic
  root. We never throw on, or drop, a span.

## Test

```sh
npx nx test core
```
