# Claude Code (CLI)

Claude Code can emit OpenTelemetry **traces** via its enhanced-telemetry beta.
tracebird maps its `claude_code.*` spans (`interaction`, `llm_request`, `tool`)
and bare attributes (`input_tokens`, `tool_name`, `user_prompt`) onto the
standard model.

## Setup

```sh
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1     # enables trace spans
export OTEL_TRACES_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Content is redacted by default — opt in to see prompts and tool details:
export OTEL_LOG_USER_PROMPTS=1
export OTEL_LOG_TOOL_DETAILS=1

claude
```

## What renders

The interaction tree (user turn → LLM requests → tools), model + provider,
token usage (input/output, including cache tokens), and — with the content
flags above — the user prompt and tool details.

## Notes

- Traces are a **beta** feature and the attribute set is still evolving; if a
  field stops mapping, please file an issue with a sample span.
- tracebird ingests **traces** only. Claude Code also exports metrics and logs
  (to `/v1/metrics` and `/v1/logs`); tracebird ignores those — harmless.
- See the official
  [Claude Code monitoring docs](https://code.claude.com/docs/en/monitoring-usage)
  for the full list of signals and content flags.
