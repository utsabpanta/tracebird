import type { Attributes, Span } from '../types.js';
import { asNumber, asString } from './util.js';

/**
 * Claude Code (the CLI) → canonical gen_ai.* adapter.
 *
 * Claude Code's enhanced telemetry (beta) emits `claude_code.*` spans —
 * `claude_code.interaction`, `claude_code.llm_request`, `claude_code.tool` —
 * with some standard gen_ai.* attributes and some bespoke/bare ones
 * (`input_tokens`, `tool_name`, `user_prompt`).
 * Docs: https://code.claude.com/docs/en/monitoring-usage
 */

export const name = 'claude-code';

export function detect(span: Span): boolean {
  if (span.name.startsWith('claude_code.')) return true;
  for (const key in span.attributes) {
    if (key.startsWith('claude_code.')) return true;
  }
  return false;
}

export function canonical(span: Span): Attributes {
  const a = span.attributes;
  const out: Attributes = {};
  const n = span.name;

  if (n.includes('llm_request') || n.includes('api_request')) {
    out['gen_ai.operation.name'] = 'chat';
    const model = asString(a['gen_ai.request.model']) ?? asString(a['model']);
    if (model) out['gen_ai.request.model'] = model;
    out['gen_ai.system'] = asString(a['gen_ai.system']) ?? 'anthropic';

    const input = asNumber(a['input_tokens']) ?? asNumber(a['gen_ai.usage.input_tokens']);
    if (input != null) out['gen_ai.usage.input_tokens'] = input;
    const output = asNumber(a['output_tokens']) ?? asNumber(a['gen_ai.usage.output_tokens']);
    if (output != null) out['gen_ai.usage.output_tokens'] = output;

    const prompt = asString(a['user_prompt']);
    if (prompt) {
      out['gen_ai.prompt.0.role'] = 'user';
      out['gen_ai.prompt.0.content'] = prompt;
    }
    const completion = asString(a['response_text']) ?? asString(a['completion']);
    if (completion) {
      out['gen_ai.completion.0.role'] = 'assistant';
      out['gen_ai.completion.0.content'] = completion;
    }
  } else if (n.includes('tool')) {
    out['gen_ai.operation.name'] = 'execute_tool';
    const tool = asString(a['tool_name']) ?? asString(a['gen_ai.tool.name']);
    if (tool) out['gen_ai.tool.name'] = tool;
    const args = a['tool_input'] ?? a['full_command'] ?? a['file_path'];
    if (args != null) out['gen_ai.tool.call.arguments'] = args;
    const result = a['tool_output'] ?? a['tool_result'];
    if (result != null) out['gen_ai.tool.call.result'] = result;
  } else if (n.includes('interaction')) {
    out['gen_ai.operation.name'] = 'invoke_agent';
    out['gen_ai.agent.name'] = asString(a['gen_ai.agent.name']) ?? 'claude-code';
    const prompt = asString(a['user_prompt']);
    if (prompt) {
      out['gen_ai.prompt.0.role'] = 'user';
      out['gen_ai.prompt.0.content'] = prompt;
    }
  }

  return out;
}
