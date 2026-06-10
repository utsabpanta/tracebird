import { at, span, traceRequest } from './builders.js';

/**
 * OpenInference (Arize Phoenix) dialect: `openinference.span.kind` + `llm.*` /
 * `tool.*` / `input.value` attributes. A small agent that calls one tool.
 */

const BASE = 1733000400000000000n;
const TRACE = 'd1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1';
const ROOT = 'd1000000000000a1';
const LLM = 'd1000000000000a2';
const TOOL = 'd1000000000000a3';

export const openinferenceAgent = traceRequest({
  serviceName: 'docs-assistant',
  scopeName: 'openinference.instrumentation.openai',
  scopeVersion: '0.1.0',
  spans: [
    span({
      traceId: TRACE,
      spanId: ROOT,
      name: 'agent',
      startTimeUnixNano: at(BASE, 0),
      endTimeUnixNano: at(BASE, 900),
      statusCode: 1,
      attributes: { 'openinference.span.kind': 'AGENT' },
    }),
    span({
      traceId: TRACE,
      spanId: LLM,
      parentSpanId: ROOT,
      name: 'ChatCompletion',
      startTimeUnixNano: at(BASE, 10),
      endTimeUnixNano: at(BASE, 460),
      statusCode: 1,
      attributes: {
        'openinference.span.kind': 'LLM',
        'llm.model_name': 'gpt-4o',
        'llm.provider': 'openai',
        'llm.token_count.prompt': 42,
        'llm.token_count.completion': 18,
        'llm.input_messages.0.message.role': 'system',
        'llm.input_messages.0.message.content': 'You answer questions about the docs.',
        'llm.input_messages.1.message.role': 'user',
        'llm.input_messages.1.message.content': 'How do I enable telemetry?',
        'llm.output_messages.0.message.role': 'assistant',
        'llm.output_messages.0.message.content': '',
        'llm.output_messages.0.message.tool_calls.0.tool_call.function.name': 'search_docs',
        'llm.output_messages.0.message.tool_calls.0.tool_call.function.arguments':
          '{"query":"enable telemetry"}',
      },
    }),
    span({
      traceId: TRACE,
      spanId: TOOL,
      parentSpanId: ROOT,
      name: 'search_docs',
      startTimeUnixNano: at(BASE, 470),
      endTimeUnixNano: at(BASE, 500),
      statusCode: 1,
      attributes: {
        'openinference.span.kind': 'TOOL',
        'tool.name': 'search_docs',
        'input.value': '{"query":"enable telemetry"}',
        'output.value': '{"hits":["Set OTEL_EXPORTER_OTLP_ENDPOINT=…"]}',
      },
    }),
  ],
});
