# Integrations

tracebird ingests the vendor-neutral OpenTelemetry **GenAI** conventions and
auto-normalizes the popular dialects, so most setups are one line: point your
exporter at the receiver and go.

```sh
npx @tracebird/cli                                    # receiver + UI on :4318
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

| Framework / SDK | Guide | Language |
| --- | --- | --- |
| OpenLLMetry (Traceloop) | [openllmetry.md](./openllmetry.md) | Python · Node |
| LangChain / LangGraph | [langchain.md](./langchain.md) | Python · Node |
| OpenInference (Arize Phoenix) | [openinference.md](./openinference.md) | Python · Node |
| Vercel AI SDK | [vercel-ai-sdk.md](./vercel-ai-sdk.md) | Node / Next.js |
| Claude Code (CLI) | [claude-code.md](./claude-code.md) | — |
| Raw OpenTelemetry | [raw-otel.md](./raw-otel.md) | any |

There are runnable starting points in [`../../examples`](../../examples),
including a keyless one.

## How matching works

tracebird classifies each span into `run → agent → llm / tool` and extracts the
model, tokens, cost, and prompt/completion. It understands all of:

- `gen_ai.operation.name` = `chat` / `execute_tool` / `invoke_agent` …
- buffered content (`gen_ai.prompt.N.*`, `gen_ai.completion.N.*`)
- JSON content (`gen_ai.input.messages` / `gen_ai.output.messages`)
- event-based content (`gen_ai.user.message`, `gen_ai.choice`, …)

…and normalizes OpenInference, Vercel AI SDK, and Claude Code dialects onto the
same model. If something renders as a generic **step** with no tokens, the
emitter is using attributes we don't map yet —
[open an issue](https://github.com/utsabpanta/tracebird/issues) with a sample
span and we'll add it.
