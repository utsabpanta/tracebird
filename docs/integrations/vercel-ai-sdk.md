# Vercel AI SDK

The [AI SDK](https://ai-sdk.dev) emits OpenTelemetry spans when you enable
`experimental_telemetry`. tracebird normalizes its `ai.*` spans
(`ai.generateText` wrapper, inner `.doGenerate` model call, `ai.toolCall`) onto
the standard model — the wrapper becomes a step and the inner call the LLM, so
tokens are never double-counted.

## Setup

Register an OTLP exporter (e.g. in `instrumentation.ts` for Next.js, or at the
top of a script), then turn on telemetry per call.

```ts
// instrumentation.ts (Next.js) — or run once at startup
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }),
}).start();
```

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'What should I wear in Paris today?',
  experimental_telemetry: { isEnabled: true, recordInputs: true, recordOutputs: true },
});
```

For Next.js, the official
[OpenTelemetry guide](https://nextjs.org/docs/app/guides/open-telemetry) wires
the exporter via `@vercel/otel`; point its endpoint at `http://localhost:4318`.

## What renders

Tree (generate/stream wrapper → LLM call → tool calls), model + provider,
prompt/completion (when `recordInputs`/`recordOutputs` are on), tokens, and cost.

## Tips

- `recordInputs` / `recordOutputs` are required to capture prompt/completion text.
- Multi-step `generateText` (tool loops) produces multiple `doGenerate` spans —
  each shows as its own LLM node.
