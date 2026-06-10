# OpenInference (Arize Phoenix)

[OpenInference](https://github.com/Arize-ai/openinference) instrumentations emit
`openinference.span.kind` (LLM / TOOL / AGENT / CHAIN / …) plus `llm.*`,
`tool.*`, and `input.value` / `output.value` attributes. tracebird maps these
onto the standard model automatically.

## Python

```sh
pip install openinference-instrumentation-openai opentelemetry-sdk \
            opentelemetry-exporter-otlp
```

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from openinference.instrumentation.openai import OpenAIInstrumentor

provider = TracerProvider()
provider.add_span_processor(
    SimpleSpanProcessor(OTLPSpanExporter("http://localhost:4318/v1/traces"))
)
trace.set_tracer_provider(provider)

OpenAIInstrumentor().instrument()
# Use the OpenAI SDK as usual.
```

The same pattern works for the LangChain, LlamaIndex, Anthropic, and Bedrock
OpenInference instrumentors.

## What renders

Tree (AGENT → LLM → TOOL), model + provider, token counts
(`llm.token_count.*`), prompt/completion messages (`llm.input_messages.*` /
`llm.output_messages.*`) including tool calls, and tool I/O from
`input.value` / `output.value`.

## Tips

- If you normally point Phoenix's collector at port 6006, just swap the OTLP
  endpoint to `http://localhost:4318` to use tracebird instead.
