import { at, span, traceRequest } from './builders.js';

/**
 * Vercel AI SDK dialect: `ai.generateText` wrapper, an inner `.doGenerate`
 * model call, and an `ai.toolCall` span — the shape emitted by
 * `experimental_telemetry`.
 */

const BASE = 1733000500000000000n;
const TRACE = 'e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1';
const ROOT = 'e1000000000000b1';
const GEN = 'e1000000000000b2';
const TOOL = 'e1000000000000b3';

export const vercelAiSdk = traceRequest({
  serviceName: 'ai-sdk-app',
  scopeName: 'ai',
  scopeVersion: '4.0.0',
  spans: [
    span({
      traceId: TRACE,
      spanId: ROOT,
      name: 'ai.generateText',
      startTimeUnixNano: at(BASE, 0),
      endTimeUnixNano: at(BASE, 1100),
      statusCode: 1,
      attributes: {
        'ai.model.id': 'gpt-4o',
        'ai.model.provider': 'openai.chat',
        'ai.usage.promptTokens': 64,
        'ai.usage.completionTokens': 30,
      },
    }),
    span({
      traceId: TRACE,
      spanId: GEN,
      parentSpanId: ROOT,
      name: 'ai.generateText.doGenerate',
      startTimeUnixNano: at(BASE, 20),
      endTimeUnixNano: at(BASE, 540),
      statusCode: 1,
      attributes: {
        'ai.model.id': 'gpt-4o',
        'ai.model.provider': 'openai.chat',
        'ai.usage.promptTokens': 64,
        'ai.usage.completionTokens': 30,
        'ai.prompt.messages':
          '[{"role":"user","content":"What is the weather in San Francisco?"}]',
        'ai.response.text': 'Let me check the current conditions in San Francisco.',
      },
    }),
    span({
      traceId: TRACE,
      spanId: TOOL,
      parentSpanId: ROOT,
      name: 'ai.toolCall',
      startTimeUnixNano: at(BASE, 560),
      endTimeUnixNano: at(BASE, 600),
      statusCode: 1,
      attributes: {
        'ai.toolCall.name': 'getWeather',
        'ai.toolCall.args': '{"city":"San Francisco"}',
        'ai.toolCall.result': '{"tempC":17,"condition":"foggy"}',
      },
    }),
  ],
});
