# @tracebird/fixtures

Sample OTLP payloads and recorded sessions used by `core`/`cli` tests and as
demo data for `tracebird open`. Private (not published).

## What's here

| Fixture | Shape |
| --- | --- |
| `weatherHappyPath` | Multi-tool agent run: plan → 2 tools → answer. |
| `toolError` | A run where an `execute_tool` span fails (ERROR status). |
| `diffPairA` / `diffPairB` | Two near-identical triage runs that diverge on one decision (P1 vs P2) — for the diff demo. |

All are exported as typed `ExportTraceServiceRequest` JSON objects, plus an
`otlpFixtures` registry. Builders in `src/otlp/builders.ts` keep the payloads
readable; the package imports nothing internal so the project graph stays
acyclic.

```sh
npx nx test fixtures
```
