# Roadmap

tracebird v1 is deliberately small: **read-only forensics on agent runs** — live
as they complete, or loaded from a saved session. The boundary below is what keeps
it focused. These are explicitly **not** in v1 — they live here so the line stays
visible.

## Later (not in v1)

- **Replay-execution** — re-running the agent from a captured run.
- **Cloud sync / hosted version** — v1 is local-first, no account, no network egress.
- **Auth / multi-user** — no login, no sharing server.
- **Eval scoring** — no automated quality/grading of runs.
- **Multi-agent topology graphs** — no cross-agent orchestration view.
- **gRPC ingest** — OTLP/HTTP only in v1 (JSON + protobuf).
- **SQLite persistence** — v1 stores append-only `.jsonl` session files.
- **VS Code extension** — browser UI only.

## Shipping order (v1)

1. **Capture** — OTLP receiver + `parseOtlp`. ✅
2. **Reconstruct** — `buildRun` decision tree, printed to the terminal. ✅
3. **Inspect** — UI: run list, execution tree, inspector. `tracebird open <file>`. ✅
4. **Time-travel + diff** — scrubber + side-by-side run/call diff. ✅
