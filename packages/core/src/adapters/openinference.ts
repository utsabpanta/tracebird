import type { Attributes, Span } from '../types.js';
import { asNumber, asString, remapIndexedMessages } from './util.js';

/**
 * OpenInference (Arize Phoenix) → canonical gen_ai.* adapter.
 *
 * OpenInference uses `openinference.span.kind` plus `llm.*` / `tool.*` /
 * `input.value` / `output.value` attributes.
 * Docs: https://github.com/Arize-ai/openinference/tree/main/spec
 */

const KIND_OP: Record<string, string> = {
  LLM: 'chat',
  TOOL: 'execute_tool',
  AGENT: 'invoke_agent',
  CHAIN: 'step',
  RETRIEVER: 'step',
  EMBEDDING: 'embeddings',
  RERANKER: 'step',
  GUARDRAIL: 'step',
  EVALUATOR: 'step',
};

export const name = 'openinference';

export function detect(span: Span): boolean {
  const a = span.attributes;
  if (asString(a['openinference.span.kind'])) return true;
  for (const key in a) {
    if (key.startsWith('llm.') || key.startsWith('tool.') || key === 'input.value') return true;
  }
  return false;
}

export function canonical(span: Span): Attributes {
  const a = span.attributes;
  const out: Attributes = {};
  const kind = asString(a['openinference.span.kind'])?.toUpperCase();

  if (kind && KIND_OP[kind]) out['gen_ai.operation.name'] = KIND_OP[kind];

  const model = asString(a['llm.model_name']);
  if (model) out['gen_ai.request.model'] = model;
  const provider = asString(a['llm.provider']) ?? asString(a['llm.system']);
  if (provider) out['gen_ai.system'] = provider;

  const input = asNumber(a['llm.token_count.prompt']);
  if (input != null) out['gen_ai.usage.input_tokens'] = input;
  const output = asNumber(a['llm.token_count.completion']);
  if (output != null) out['gen_ai.usage.output_tokens'] = output;
  const total = asNumber(a['llm.token_count.total']);
  if (total != null) out['gen_ai.usage.total_tokens'] = total;

  remapIndexedMessages(a, 'llm.input_messages', 'message', 'gen_ai.prompt', out);
  remapIndexedMessages(a, 'llm.output_messages', 'message', 'gen_ai.completion', out);

  const toolName = asString(a['tool.name']);
  if (toolName) out['gen_ai.tool.name'] = toolName;
  if (kind === 'TOOL') {
    if (a['input.value'] != null) out['gen_ai.tool.call.arguments'] = a['input.value'];
    if (a['output.value'] != null) out['gen_ai.tool.call.result'] = a['output.value'];
  }

  // Fall back to input.value / output.value when no structured messages exist.
  if (kind === 'LLM') {
    if (out['gen_ai.prompt.0.role'] === undefined && typeof a['input.value'] === 'string') {
      out['gen_ai.input.messages'] = a['input.value'];
    }
    if (out['gen_ai.completion.0.role'] === undefined && typeof a['output.value'] === 'string') {
      out['gen_ai.output.messages'] = a['output.value'];
    }
  }

  return out;
}
