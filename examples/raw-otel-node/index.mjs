// Emit a small, hand-built agent trace to tracebird using the OpenTelemetry SDK.
// No LLM API key required — this just demonstrates the OTLP wire format and that
// tracebird captures real spans (not only fixtures).
//
//   1. In one terminal:  pnpm start           (or: npx @tracebird/cli)
//   2. In this folder:   pnpm install && pnpm start
//   3. Watch the run appear live in the UI.

import { trace } from '@opentelemetry/api';
import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

const provider = new NodeTracerProvider({
  resource: new Resource({ [ATTR_SERVICE_NAME]: 'raw-otel-example' }),
  spanProcessors: [new SimpleSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }))],
});
provider.register();

const tracer = trace.getTracer('raw-otel-example');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await tracer.startActiveSpan('invoke_agent time-assistant', async (root) => {
  root.setAttributes({
    'gen_ai.operation.name': 'invoke_agent',
    'gen_ai.agent.name': 'time-assistant',
    'gen_ai.system': 'openai',
  });

  await tracer.startActiveSpan('chat gpt-4o', async (llm) => {
    llm.setAttributes({
      'gen_ai.operation.name': 'chat',
      'gen_ai.system': 'openai',
      'gen_ai.request.model': 'gpt-4o',
      'gen_ai.usage.input_tokens': 48,
      'gen_ai.usage.output_tokens': 22,
      'gen_ai.prompt.0.role': 'user',
      'gen_ai.prompt.0.content': 'What time is it in Tokyo?',
      'gen_ai.completion.0.role': 'assistant',
      'gen_ai.completion.0.content': '',
      'gen_ai.completion.0.tool_calls.0.name': 'get_time',
      'gen_ai.completion.0.tool_calls.0.arguments': '{"tz":"Asia/Tokyo"}',
    });
    await sleep(140);
    llm.end();
  });

  await tracer.startActiveSpan('execute_tool get_time', async (tool) => {
    tool.setAttributes({
      'gen_ai.operation.name': 'execute_tool',
      'gen_ai.tool.name': 'get_time',
      'gen_ai.tool.call.arguments': '{"tz":"Asia/Tokyo"}',
      'gen_ai.tool.call.result': '{"time":"2026-06-09T22:14:00+09:00"}',
    });
    await sleep(20);
    tool.end();
  });

  await tracer.startActiveSpan('chat gpt-4o', async (llm) => {
    llm.setAttributes({
      'gen_ai.operation.name': 'chat',
      'gen_ai.system': 'openai',
      'gen_ai.request.model': 'gpt-4o',
      'gen_ai.usage.input_tokens': 86,
      'gen_ai.usage.output_tokens': 14,
      'gen_ai.prompt.0.role': 'user',
      'gen_ai.prompt.0.content': 'What time is it in Tokyo?',
      'gen_ai.prompt.1.role': 'tool',
      'gen_ai.prompt.1.content': '{"time":"2026-06-09T22:14:00+09:00"}',
      'gen_ai.completion.0.role': 'assistant',
      'gen_ai.completion.0.content': "It's 10:14 PM in Tokyo.",
    });
    await sleep(160);
    llm.end();
  });

  root.end();
});

await provider.forceFlush();
await provider.shutdown();
console.log(`✓ sent a sample agent trace to ${endpoint}/v1/traces — check the tracebird UI`);
