# @tracebird/smoke

End-to-end smoke test. It spawns the **built** `@tracebird/cli` binary, posts an
OTLP fixture to the live receiver, waits for the trace to flush, and asserts the
reconstructed tree is served over the JSON API — the whole capture → reconstruct
→ serve loop through the real artifact.

```sh
npx nx run smoke:e2e   # builds the CLI first, then runs the test
```
