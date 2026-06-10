import type { Attributes, Span } from '../types.js';
import { asNumber, asString } from './util.js';

/**
 * Vercel AI SDK (`experimental_telemetry`) → canonical gen_ai.* adapter.
 *
 * The AI SDK emits `ai.*` spans: `ai.generateText` / `ai.streamText` wrappers
 * with inner `.doGenerate` / `.doStream` model calls, plus `ai.toolCall` spans.
 * Docs: https://ai-sdk.dev/docs/ai-sdk-core/telemetry
 */

export const name = 'vercel-ai-sdk';

export function detect(span: Span): boolean {
  if (span.name.startsWith('ai.')) return true;
  for (const key in span.attributes) {
    if (key.startsWith('ai.')) return true;
  }
  return false;
}

function classify(span: Span): string | undefined {
  const a = span.attributes;
  const n = span.name;
  if (a['ai.toolCall.name'] != null || n === 'ai.toolCall') return 'execute_tool';
  // Inner model call carries the real usage → the LLM node.
  if (/\.doGenerate|\.doStream/.test(n)) return 'chat';
  // Outer wrappers aggregate usage but must NOT double-count as a second call.
  if (/^ai\.embed/.test(n)) return 'embeddings';
  if (/^ai\.(generateText|streamText|generateObject|streamObject)/.test(n)) return 'step';
  if (a['ai.usage.promptTokens'] != null || a['ai.usage.inputTokens'] != null) return 'chat';
  return undefined;
}

export function canonical(span: Span): Attributes {
  const a = span.attributes;
  const out: Attributes = {};

  const op = classify(span);
  if (op) out['gen_ai.operation.name'] = op;

  const model = asString(a['ai.model.id']) ?? asString(a['ai.model.provider.modelId']);
  if (model) out['gen_ai.request.model'] = model;
  const provider = asString(a['ai.model.provider']);
  if (provider) out['gen_ai.system'] = provider.split('.')[0];

  const input = asNumber(a['ai.usage.promptTokens']) ?? asNumber(a['ai.usage.inputTokens']);
  if (input != null) out['gen_ai.usage.input_tokens'] = input;
  const output = asNumber(a['ai.usage.completionTokens']) ?? asNumber(a['ai.usage.outputTokens']);
  if (output != null) out['gen_ai.usage.output_tokens'] = output;

  // Prompt: ai.prompt.messages is a JSON array of {role, content}.
  if (a['ai.prompt.messages'] != null) out['gen_ai.input.messages'] = a['ai.prompt.messages'];
  else if (typeof a['ai.prompt'] === 'string') out['gen_ai.input.messages'] = a['ai.prompt'];

  // Completion: the response text becomes a single assistant message.
  const responseText = asString(a['ai.response.text']) ?? asString(a['ai.result.text']);
  if (responseText != null) {
    out['gen_ai.completion.0.role'] = 'assistant';
    out['gen_ai.completion.0.content'] = responseText;
  }

  // Tool call spans.
  const toolName = asString(a['ai.toolCall.name']);
  if (toolName) out['gen_ai.tool.name'] = toolName;
  if (a['ai.toolCall.args'] != null) out['gen_ai.tool.call.arguments'] = a['ai.toolCall.args'];
  if (a['ai.toolCall.result'] != null) out['gen_ai.tool.call.result'] = a['ai.toolCall.result'];

  return out;
}
