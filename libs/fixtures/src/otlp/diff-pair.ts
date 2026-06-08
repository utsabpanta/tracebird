import { at, span, traceRequest } from './builders.js';

/**
 * Two near-identical triage runs over the same support ticket that diverge on a
 * single decision: run A (gpt-4o) assigns priority P1; run B (gpt-4o-mini)
 * assigns P2. Same prompt, same shape — ideal for the diff demo.
 */

const TICKET =
  'Customer reports the checkout page returns a 500 error intermittently on mobile Safari. ' +
  'They have tried twice. No charge was made.';

const SYSTEM =
  'You are a support triage agent. Read the ticket and assign a priority from P1 (urgent) to P4 (low).';

function triageRun(opts: {
  base: bigint;
  trace: string;
  rootId: string;
  llmId: string;
  model: string;
  responseModel: string;
  outputTokens: number;
  endMs: number;
  completion: string;
}) {
  return traceRequest({
    serviceName: 'support-triage',
    scopeName: 'opentelemetry.instrumentation.openai',
    scopeVersion: '0.30.0',
    spans: [
      span({
        traceId: opts.trace,
        spanId: opts.rootId,
        name: 'invoke_agent support-triage',
        startTimeUnixNano: at(opts.base, 0),
        endTimeUnixNano: at(opts.base, opts.endMs),
        statusCode: 1,
        attributes: {
          'gen_ai.operation.name': 'invoke_agent',
          'gen_ai.agent.name': 'support-triage',
          'gen_ai.system': 'openai',
        },
      }),
      span({
        traceId: opts.trace,
        spanId: opts.llmId,
        parentSpanId: opts.rootId,
        name: `chat ${opts.model}`,
        startTimeUnixNano: at(opts.base, 6),
        endTimeUnixNano: at(opts.base, opts.endMs - 4),
        statusCode: 1,
        attributes: {
          'gen_ai.operation.name': 'chat',
          'gen_ai.system': 'openai',
          'gen_ai.request.model': opts.model,
          'gen_ai.response.model': opts.responseModel,
          'gen_ai.request.temperature': 0.2,
          'gen_ai.usage.input_tokens': 96,
          'gen_ai.usage.output_tokens': opts.outputTokens,
          'gen_ai.prompt.0.role': 'system',
          'gen_ai.prompt.0.content': SYSTEM,
          'gen_ai.prompt.1.role': 'user',
          'gen_ai.prompt.1.content': TICKET,
          'gen_ai.completion.0.role': 'assistant',
          'gen_ai.completion.0.content': opts.completion,
        },
      }),
    ],
  });
}

export const diffPairA = triageRun({
  base: 1733000200000000000n,
  trace: 'c1000000000000000000000000000a01',
  rootId: 'c100000000000a01',
  llmId: 'c100000000000a02',
  model: 'gpt-4o',
  responseModel: 'gpt-4o-2024-08-06',
  outputTokens: 54,
  endMs: 640,
  completion:
    'Priority: P1. A 500 error at checkout blocks revenue and affects all mobile Safari ' +
    'users intermittently. Escalate to the payments team immediately.',
});

export const diffPairB = triageRun({
  base: 1733000300000000000n,
  trace: 'c2000000000000000000000000000b01',
  rootId: 'c200000000000b01',
  llmId: 'c200000000000b02',
  model: 'gpt-4o-mini',
  responseModel: 'gpt-4o-mini-2024-07-18',
  outputTokens: 48,
  endMs: 410,
  completion:
    'Priority: P2. Checkout returns a 500 on mobile Safari intermittently, but no charge ' +
    'was made and a retry path exists. Route to the web team for investigation.',
});
