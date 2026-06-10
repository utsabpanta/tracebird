# Examples

Runnable ways to send real traces to tracebird. Start the receiver first:

```sh
# from the repo root
pnpm start            # or: npx @tracebird/cli
```

Then run an example in another terminal. Each is a **standalone pnpm project**
(intentionally outside the monorepo workspace, so its heavy deps never touch the
core install) — `cd` in and `pnpm install`.

| Example | Needs an API key? | What it shows |
| --- | --- | --- |
| [`raw-otel-node`](./raw-otel-node) | ❌ No | Emit a hand-built agent trace via the OpenTelemetry SDK — proves the OTLP wire end-to-end. |
| [`openllmetry-node`](./openllmetry-node) | ✅ `OPENAI_API_KEY` | Auto-instrument a real OpenAI tool-calling run with OpenLLMetry. |

## Other stacks (no example yet — same idea)

Point any OpenTelemetry GenAI exporter at `http://localhost:4318`:

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

tracebird normalizes the popular dialects automatically (OpenLLMetry,
OpenInference / Arize Phoenix, the Vercel AI SDK's `experimental_telemetry`, and
Claude Code's enhanced telemetry), so the tree, tokens, cost, and prompts all
render without configuration.
