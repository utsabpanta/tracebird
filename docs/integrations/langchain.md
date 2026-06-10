# LangChain / LangGraph

LangChain doesn't emit OpenTelemetry GenAI spans on its own — use one of the
auto-instrumentation layers below. Both feed tracebird cleanly.

## Option A — OpenLLMetry (recommended)

```sh
pip install traceloop-sdk
```

```python
from traceloop.sdk import Traceloop
Traceloop.init(app_name="langchain-agent", api_endpoint="http://localhost:4318",
               disable_batch=True)

# Build and run your LangChain / LangGraph app as usual.
```

Node:

```ts
import * as traceloop from '@traceloop/node-server-sdk';
traceloop.initialize({ appName: 'langchain-agent', baseUrl: 'http://localhost:4318', disableBatch: true });
```

## Option B — OpenInference

```sh
pip install openinference-instrumentation-langchain opentelemetry-exporter-otlp
```

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from openinference.instrumentation.langchain import LangChainInstrumentor

provider = TracerProvider()
provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter("http://localhost:4318/v1/traces")))
trace.set_tracer_provider(provider)
LangChainInstrumentor().instrument()
```

## What renders

Chains/agents as the tree structure, each LLM call with model + tokens + cost,
and tool calls with their arguments and results. LangGraph node transitions show
up as nested spans.
