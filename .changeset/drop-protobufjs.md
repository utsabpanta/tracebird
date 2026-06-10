---
'@tracebird/core': patch
'@tracebird/cli': patch
---

Remove the `protobufjs` dependency in favor of a vendored, zero-dependency OTLP
protobuf decoder/encoder. `@tracebird/cli` now has no third-party runtime
dependencies (only `@tracebird/core`, which already had none) — smaller install,
faster `npx`, and a clean supply-chain surface. Verified against real payloads
from the official `@opentelemetry/exporter-trace-otlp-proto` exporter.
