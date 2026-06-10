# @tracebird/core

## 0.1.1

### Patch Changes

- 1b22d2f: Remove the `protobufjs` dependency in favor of a vendored, zero-dependency OTLP
  protobuf decoder/encoder. `@tracebird/cli` now has no third-party runtime
  dependencies (only `@tracebird/core`, which already had none) — smaller install,
  faster `npx`, and a clean supply-chain surface. Verified against real payloads
  from the official `@opentelemetry/exporter-trace-otlp-proto` exporter.

## 0.1.0

### Minor Changes

- 8fb2a89: Initial release of tracebird — a local-first, time-travel debugger for AI agent
  runs. Capture OpenTelemetry GenAI spans via a drop-in OTLP receiver, reconstruct
  them into an agent decision tree, inspect any node, scrub through the run in
  time, and diff two runs side by side.
