# OpenLLMetry (Traceloop)

[OpenLLMetry](https://github.com/traceloop/openllmetry) auto-instruments OpenAI,
Anthropic, Cohere, LangChain, LlamaIndex, and many more. It emits the
`gen_ai.*` buffered-content convention that tracebird supports natively — the
richest, lowest-effort integration.

## Python

```sh
pip install traceloop-sdk
```

```python
from traceloop.sdk import Traceloop

Traceloop.init(
    app_name="my-agent",
    api_endpoint="http://localhost:4318",  # tracebird's receiver
    disable_batch=True,                    # export immediately (nice locally)
)

# Use the OpenAI / Anthropic / LangChain SDK as usual — spans are emitted.
```

## Node / TypeScript

```sh
npm i @traceloop/node-server-sdk
```

```ts
import * as traceloop from '@traceloop/node-server-sdk';

traceloop.initialize({
  appName: 'my-agent',
  baseUrl: 'http://localhost:4318',
  disableBatch: true,
});
```

There's a runnable version in
[`examples/openllmetry-node`](../../examples/openllmetry-node).

## What renders

Full tree (agent → LLM → tool), model, input/output tokens, estimated cost, and
prompt/completion messages including tool calls.

## Tips

- Group multi-step agents under one parent span with `withWorkflow` (Node) or
  the `@workflow` decorator (Python) for a clean run tree.
- `disable_batch` / `disableBatch` flushes per span, so runs show up instantly.
