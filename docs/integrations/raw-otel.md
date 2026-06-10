# Raw OpenTelemetry

If your framework isn't listed, you can emit spans directly with the
OpenTelemetry SDK using the GenAI conventions. tracebird only needs an OTLP/HTTP
exporter pointed at its receiver.

## Minimal Node example

```ts
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const provider = new NodeTracerProvider({
  spanProcessors: [
    new SimpleSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' })),
  ],
});
provider.register();
const tracer = trace.getTracer('my-agent');

await tracer.startActiveSpan('invoke_agent my-agent', async (root) => {
  root.setAttribute('gen_ai.operation.name', 'invoke_agent');

  await tracer.startActiveSpan('chat gpt-4o', async (llm) => {
    llm.setAttributes({
      'gen_ai.operation.name': 'chat',
      'gen_ai.request.model': 'gpt-4o',
      'gen_ai.usage.input_tokens': 42,
      'gen_ai.usage.output_tokens': 18,
      'gen_ai.prompt.0.role': 'user',
      'gen_ai.prompt.0.content': 'hello',
      'gen_ai.completion.0.role': 'assistant',
      'gen_ai.completion.0.content': 'hi!',
    });
    llm.end();
  });

  root.end();
});
```

A complete, runnable version (no API key) lives in
[`examples/raw-otel-node`](../../examples/raw-otel-node).

## Attribute cheat-sheet

| Field | Attribute |
| --- | --- |
| Node kind | `gen_ai.operation.name` = `chat` / `execute_tool` / `invoke_agent` |
| Model | `gen_ai.request.model` |
| Provider | `gen_ai.system` |
| Tokens | `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` |
| Prompt | `gen_ai.prompt.<i>.role` / `gen_ai.prompt.<i>.content` |
| Completion | `gen_ai.completion.<i>.role` / `gen_ai.completion.<i>.content` |
| Tool | `gen_ai.tool.name`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result` |

Parent/child span relationships (via active-span nesting) become the tree.
