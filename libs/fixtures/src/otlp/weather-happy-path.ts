import { at, span, traceRequest } from './builders.js';

/**
 * Happy-path, multi-tool agent run: a weather assistant that makes one planning
 * LLM call, fans out to two tools (get_weather, get_forecast), then makes a
 * final LLM call to compose the answer. Uses the OpenLLMetry-style buffered
 * prompt/completion attributes (`gen_ai.prompt.N.*` / `gen_ai.completion.N.*`).
 */

const BASE = 1733000000000000000n;
const TRACE = '0af7651916cd43dd8448eb211c80319c';

const ROOT = '1111111111111111';
const LLM1 = '2222222222222222';
const TOOL1 = '3333333333333333';
const TOOL2 = '4444444444444444';
const LLM2 = '5555555555555555';

export const weatherHappyPath = traceRequest({
  serviceName: 'weather-assistant',
  scopeName: 'opentelemetry.instrumentation.openai',
  scopeVersion: '0.30.0',
  spans: [
    span({
      traceId: TRACE,
      spanId: ROOT,
      name: 'invoke_agent weather-assistant',
      startTimeUnixNano: at(BASE, 0),
      endTimeUnixNano: at(BASE, 1300),
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
      startTimeUnixNano: at(BASE, 10),
      endTimeUnixNano: at(BASE, 520),
      statusCode: 1,
      attributes: {
        'gen_ai.operation.name': 'chat',
        'gen_ai.system': 'openai',
        'gen_ai.request.model': 'gpt-4o',
        'gen_ai.response.model': 'gpt-4o-2024-08-06',
        'gen_ai.request.temperature': 0.7,
        'gen_ai.usage.input_tokens': 58,
        'gen_ai.usage.output_tokens': 34,
        'gen_ai.prompt.0.role': 'system',
        'gen_ai.prompt.0.content':
          'You are a helpful weather assistant. Use tools to look up live data before answering.',
        'gen_ai.prompt.1.role': 'user',
        'gen_ai.prompt.1.content': 'What should I wear in Paris today?',
        'gen_ai.completion.0.role': 'assistant',
        'gen_ai.completion.0.content': '',
        'gen_ai.completion.0.tool_calls.0.id': 'call_weather',
        'gen_ai.completion.0.tool_calls.0.name': 'get_weather',
        'gen_ai.completion.0.tool_calls.0.arguments': '{"location":"Paris"}',
        'gen_ai.completion.0.tool_calls.1.id': 'call_forecast',
        'gen_ai.completion.0.tool_calls.1.name': 'get_forecast',
        'gen_ai.completion.0.tool_calls.1.arguments': '{"location":"Paris","hours":12}',
      },
    }),
    span({
      traceId: TRACE,
      spanId: TOOL1,
      parentSpanId: ROOT,
      name: 'execute_tool get_weather',
      startTimeUnixNano: at(BASE, 530),
      endTimeUnixNano: at(BASE, 548),
      statusCode: 1,
      attributes: {
        'gen_ai.operation.name': 'execute_tool',
        'gen_ai.tool.name': 'get_weather',
        'gen_ai.tool.call.id': 'call_weather',
        'gen_ai.tool.call.arguments': '{"location":"Paris"}',
        'gen_ai.tool.call.result': '{"tempC":18,"condition":"sunny","humidity":0.41}',
      },
    }),
    span({
      traceId: TRACE,
      spanId: TOOL2,
      parentSpanId: ROOT,
      name: 'execute_tool get_forecast',
      startTimeUnixNano: at(BASE, 532),
      endTimeUnixNano: at(BASE, 560),
      statusCode: 1,
      attributes: {
        'gen_ai.operation.name': 'execute_tool',
        'gen_ai.tool.name': 'get_forecast',
        'gen_ai.tool.call.id': 'call_forecast',
        'gen_ai.tool.call.arguments': '{"location":"Paris","hours":12}',
        'gen_ai.tool.call.result': '{"highC":21,"lowC":12,"rain":false}',
      },
    }),
    span({
      traceId: TRACE,
      spanId: LLM2,
      parentSpanId: ROOT,
      name: 'chat gpt-4o',
      startTimeUnixNano: at(BASE, 580),
      endTimeUnixNano: at(BASE, 1290),
      statusCode: 1,
      attributes: {
        'gen_ai.operation.name': 'chat',
        'gen_ai.system': 'openai',
        'gen_ai.request.model': 'gpt-4o',
        'gen_ai.response.model': 'gpt-4o-2024-08-06',
        'gen_ai.request.temperature': 0.7,
        'gen_ai.usage.input_tokens': 140,
        'gen_ai.usage.output_tokens': 42,
        'gen_ai.prompt.0.role': 'system',
        'gen_ai.prompt.0.content':
          'You are a helpful weather assistant. Use tools to look up live data before answering.',
        'gen_ai.prompt.1.role': 'user',
        'gen_ai.prompt.1.content': 'What should I wear in Paris today?',
        'gen_ai.prompt.2.role': 'tool',
        'gen_ai.prompt.2.content': '{"tempC":18,"condition":"sunny","humidity":0.41}',
        'gen_ai.prompt.3.role': 'tool',
        'gen_ai.prompt.3.content': '{"highC":21,"lowC":12,"rain":false}',
        'gen_ai.completion.0.role': 'assistant',
        'gen_ai.completion.0.content':
          "It's 18°C and sunny in Paris, with a high of 21°C and no rain expected. " +
          "A light jacket or long sleeves will be perfect — you won't need an umbrella.",
      },
    }),
  ],
});
