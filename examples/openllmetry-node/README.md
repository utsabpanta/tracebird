# openllmetry-node

A real OpenAI tool-calling run, auto-instrumented with
[OpenLLMetry](https://github.com/traceloop/openllmetry) and sent to tracebird.
The only tracebird-specific code is the `baseUrl` in `traceloop.initialize()`.

```sh
# terminal 1 — start tracebird (from the repo root)
pnpm start                 # or: npx @tracebird/cli

# terminal 2 — here
export OPENAI_API_KEY=sk-...
pnpm install
pnpm start
```

You'll get a `weather-assistant` run: a planning LLM call → `get_weather` tool →
a final LLM call, with prompts, completions, tokens, and cost all populated.

## Other providers / frameworks

OpenLLMetry auto-instruments Anthropic, LangChain, LlamaIndex, and more — keep
the `initialize()` call and swap the client. Or set the standard env var on any
OpenTelemetry exporter:

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```
