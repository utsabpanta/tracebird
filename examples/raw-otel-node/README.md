# raw-otel-node

Send a hand-built agent trace to tracebird with the OpenTelemetry SDK —
**no LLM API key required.** Good for confirming the receiver works and for
seeing the live (SSE) update in action.

```sh
# terminal 1 — start tracebird (from the repo root)
pnpm start                 # or: npx @tracebird/cli

# terminal 2 — here
pnpm install
pnpm start
```

You'll see a `time-assistant` run appear instantly in the UI: an agent that
makes an LLM call, runs the `get_time` tool, then answers.

Point at a different receiver with `OTEL_EXPORTER_OTLP_ENDPOINT`:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:5000 pnpm start
```
