import { at, span, traceRequest } from './builders.js';

/**
 * A run where a tool call fails: the model asks for weather in a place the tool
 * can't resolve, the `execute_tool` span carries an ERROR status, and the agent
 * recovers with an apology. Exercises error propagation in the tree.
 */

const BASE = 1733000100000000000n;
const TRACE = 'b2c3d4e5f60718293a4b5c6d7e8f9012';

const ROOT = 'aa00000000000001';
const LLM1 = 'aa00000000000002';
const TOOL1 = 'aa00000000000003';
const LLM2 = 'aa00000000000004';

export const toolError = traceRequest({
  serviceName: 'weather-assistant',
  scopeName: 'opentelemetry.instrumentation.openai',
  scopeVersion: '0.30.0',
  spans: [
    span({
      traceId: TRACE,
      spanId: ROOT,
      name: 'invoke_agent weather-assistant',
      startTimeUnixNano: at(BASE, 0),
      endTimeUnixNano: at(BASE, 900),
      statusCode: 1,
      attributes: {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.agent.name': 'weather-assistant',
        'gen_ai.system': 'openai',
      },
    }),
    span({
      traceId: TRACE,
      spanId: LLM1,
      parentSpanId: ROOT,
      name: 'chat gpt-4o',
      startTimeUnixNano: at(BASE, 8),
      endTimeUnixNano: at(BASE, 410),
      statusCode: 1,
      attributes: {
        'gen_ai.operation.name': 'chat',
        'gen_ai.system': 'openai',
        'gen_ai.request.model': 'gpt-4o',
        'gen_ai.response.model': 'gpt-4o-2024-08-06',
        'gen_ai.usage.input_tokens': 52,
        'gen_ai.usage.output_tokens': 16,
        'gen_ai.prompt.0.role': 'user',
        'gen_ai.prompt.0.content': "What's the weather in Atlantis?",
        'gen_ai.completion.0.role': 'assistant',
        'gen_ai.completion.0.content': '',
        'gen_ai.completion.0.tool_calls.0.id': 'call_weather',
        'gen_ai.completion.0.tool_calls.0.name': 'get_weather',
        'gen_ai.completion.0.tool_calls.0.arguments': '{"location":"Atlantis"}',
      },
    }),
    span({
      traceId: TRACE,
      spanId: TOOL1,
      parentSpanId: ROOT,
      name: 'execute_tool get_weather',
      startTimeUnixNano: at(BASE, 420),
      endTimeUnixNano: at(BASE, 438),
      statusCode: 2,
      statusMessage: 'UnknownLocationError: no such location "Atlantis"',
      attributes: {
        'gen_ai.operation.name': 'execute_tool',
        'gen_ai.tool.name': 'get_weather',
        'gen_ai.tool.call.id': 'call_weather',
        'gen_ai.tool.call.arguments': '{"location":"Atlantis"}',
        'error.type': 'UnknownLocationError',
        'gen_ai.tool.call.result': '{"error":"no such location \\"Atlantis\\""}',
      },
    }),
    span({
      traceId: TRACE,
      spanId: LLM2,
      parentSpanId: ROOT,
      name: 'chat gpt-4o',
      startTimeUnixNano: at(BASE, 450),
      endTimeUnixNano: at(BASE, 890),
      statusCode: 1,
      attributes: {
        'gen_ai.operation.name': 'chat',
        'gen_ai.system': 'openai',
        'gen_ai.request.model': 'gpt-4o',
        'gen_ai.response.model': 'gpt-4o-2024-08-06',
        'gen_ai.usage.input_tokens': 88,
        'gen_ai.usage.output_tokens': 28,
        'gen_ai.prompt.0.role': 'user',
        'gen_ai.prompt.0.content': "What's the weather in Atlantis?",
        'gen_ai.prompt.1.role': 'tool',
        'gen_ai.prompt.1.content': '{"error":"no such location \\"Atlantis\\""}',
        'gen_ai.completion.0.role': 'assistant',
        'gen_ai.completion.0.content':
          "I couldn't find a place called \"Atlantis\" to look up the weather. Could you double-check the spelling or give me a nearby city?",
      },
    }),
  ],
});
