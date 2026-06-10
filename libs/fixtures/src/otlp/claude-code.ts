import { at, span, traceRequest } from './builders.js';

/**
 * Claude Code (CLI) enhanced-telemetry dialect: `claude_code.interaction`,
 * `claude_code.llm_request`, `claude_code.tool` spans with bare token counts
 * and `tool_name` / `user_prompt` attributes.
 */

const BASE = 1733000600000000000n;
const TRACE = 'f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1';
const ROOT = 'f1000000000000c1';
const LLM = 'f1000000000000c2';
const TOOL = 'f1000000000000c3';

export const claudeCodeSession = traceRequest({
  serviceName: 'claude-code',
  scopeName: 'com.anthropic.claude_code',
  scopeVersion: '2.0.0',
  spans: [
    span({
      traceId: TRACE,
      spanId: ROOT,
      name: 'claude_code.interaction',
      startTimeUnixNano: at(BASE, 0),
      endTimeUnixNano: at(BASE, 4200),
      statusCode: 1,
      attributes: {
        'user_prompt': 'Add a --json flag to the parser CLI',
        'interaction.sequence': 1,
      },
    }),
    span({
      traceId: TRACE,
      spanId: LLM,
      parentSpanId: ROOT,
      name: 'claude_code.llm_request',
      startTimeUnixNano: at(BASE, 30),
      endTimeUnixNano: at(BASE, 2600),
      statusCode: 1,
      attributes: {
        'gen_ai.system': 'anthropic',
        'gen_ai.request.model': 'claude-sonnet-4',
        'input_tokens': 1840,
        'output_tokens': 420,
        'cache_read_tokens': 12000,
        'gen_ai.response.finish_reasons': 'tool_use',
        'user_prompt': 'Add a --json flag to the parser CLI',
      },
    }),
    span({
      traceId: TRACE,
      spanId: TOOL,
      parentSpanId: ROOT,
      name: 'claude_code.tool',
      startTimeUnixNano: at(BASE, 2650),
      endTimeUnixNano: at(BASE, 2710),
      statusCode: 1,
      attributes: {
        'tool_name': 'Edit',
        'file_path': 'packages/cli/src/parser.ts',
        'tool_output': 'Applied 1 edit to packages/cli/src/parser.ts',
      },
    }),
  ],
});
