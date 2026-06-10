// A real OpenAI tool-calling run, auto-instrumented with OpenLLMetry and sent to
// tracebird. The only tracebird-specific line is the `baseUrl` in initialize().
//
//   1. In one terminal:  pnpm start            (or: npx @tracebird/cli)
//   2. Here:             export OPENAI_API_KEY=sk-...
//                        pnpm install && pnpm start
//
// OpenLLMetry also auto-instruments Anthropic, LangChain, LlamaIndex, etc. —
// swap the client and it just works.

import * as traceloop from '@traceloop/node-server-sdk';
import OpenAI from 'openai';

traceloop.initialize({
  appName: 'weather-assistant',
  baseUrl: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
  disableBatch: true, // export each span immediately (nice for local debugging)
});

const openai = new OpenAI();

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a city.',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  },
];

async function run() {
  const messages = [{ role: 'user', content: 'What should I wear in Paris today?' }];

  const first = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    tools,
  });
  const choice = first.choices[0].message;
  messages.push(choice);

  for (const call of choice.tool_calls ?? []) {
    // Pretend tool — return canned weather so no extra API is needed.
    const result = { tempC: 18, condition: 'sunny', highC: 21 };
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify(result),
    });
  }

  const final = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages });
  console.log('\nAssistant:', final.choices[0].message.content);
}

// withWorkflow groups the calls under one parent span → a clean run tree.
await traceloop.withWorkflow({ name: 'weather-assistant' }, run);

// Give the exporter a moment to flush before the process exits.
await new Promise((r) => setTimeout(r, 1500));
console.log('\n✓ trace sent — open the tracebird UI to inspect the run.');
