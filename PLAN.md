# SPEC.md — AgentScope DevTools (working title)

> **A local-first, time-travel debugger for AI agent runs.**
> "Redux DevTools for AI agents." Point it at any OpenTelemetry-emitting agent,
> step through the run locally, diff two runs to see what changed. No cloud, no account.

---

## ⚠️ NAME CHECK (read first)

The namespace `@agentscope` is used as a placeholder throughout this spec.
**`agentscope` is an existing multi-agent framework** — the npm scope and GitHub org
are likely taken and the name will cause brand confusion.

Before doing anything else: pick a final name, verify availability on npm
(`npm view @NAME/cli`) and GitHub, then find-replace `@agentscope` → `@finalname`
across this spec and the generated code. If the user has not chosen one, STOP and ask.

---

## 1. What we're building

AI agents fail silently: they return a confident, wrong answer with no crash, no
stack trace, no error. Existing tools are cloud dashboards (Langfuse, LangSmith,
Datadog). **Nobody owns the local, open-source, framework-agnostic step-debugger.**

This tool:
1. **Ingests** OpenTelemetry GenAI spans from any already-instrumented agent (zero code change — just point the OTLP endpoint at us).
2. **Reconstructs** flat spans into an agent decision tree: runs → steps → LLM calls / tool calls.
3. **Inspects** any node: prompt, completion, tool args/results, tokens, cost, latency, model.
4. **Diffs** two runs (or two LLM calls) side by side to answer "why did it behave differently today?"

v1 is **read-only forensics on a completed run.** No replay-execution, no cloud sync,
no auth, no eval scoring, no multi-agent topology graphs. Resist all of these.

---

## 2. Stack & conventions (non-negotiable)

- **Monorepo:** Nx (latest). Integrated repo (not package-based) so we get the task graph + caching.
- **Package manager:** pnpm. Workspaces via `pnpm-workspace.yaml` + Nx.
- **Runtime:** Node ≥ 20 (use `node:` import prefix for builtins).
- **Language:** TypeScript, `strict: true`, ESM (`"type": "module"`).
- **Lint/format:** ESLint (Nx preset) + Prettier.
- **Tests:** Vitest across all packages.
- **UI:** React + Vite, built to static assets and bundled into the CLI package.
- **Telemetry input:** OpenTelemetry OTLP/HTTP (protobuf + JSON). gRPC is a v2 nice-to-have — do NOT build it in v1.
- **Persistence:** local `.jsonl` session files (one run per file, append-only). SQLite is v2.

Conventions Claude Code must follow:
- Conventional Commits.
- Every package has its own `README.md`, `vitest` setup, and `project.json` (Nx target config).
- No `any` without a `// eslint-disable` + reason.
- Pure functions for the trace-model layer (easy to unit test); side effects (network, fs) isolated in the CLI.

---

## 3. Package layout

Nx integrated monorepo. Three publishable packages under `packages/`, plus an `e2e` app and a `fixtures` lib.

```
agentscope-devtools/
├── nx.json
├── pnpm-workspace.yaml
├── package.json                 # root, private
├── tsconfig.base.json
├── packages/
│   ├── core/                    # @agentscope/core  — span → tree reconstruction (pure, no I/O)
│   ├── cli/                     # @agentscope/cli    — the npx entrypoint: OTLP receiver + static UI server
│   └── ui/                      # @agentscope/ui     — React/Vite app, built into cli at package time
├── libs/
│   └── fixtures/                # @agentscope/fixtures — sample OTLP payloads + recorded runs for tests/demos
└── e2e/
    └── smoke/                   # end-to-end: post fixture → CLI → assert tree served
```

**Dependency direction:** `cli` → `core`; `ui` → `core` (types only); `core` depends on nothing internal.
Nx must enforce this with module-boundary tags (`scope:core`, `scope:cli`, `scope:ui`).

---

## 4. Package specs

### 4.1 `@agentscope/core`
The technical heart. **Pure TypeScript, no fs/network.** Fully unit-tested.

Responsibilities:
- **Types:** define the normalized model — `Run`, `Step`, `LlmCall`, `ToolCall`, `TraceNode` (discriminated union on `kind`).
- **Ingest:** parse an OTLP `ExportTraceServiceRequest` (resourceSpans → scopeSpans → spans) into a flat `Span[]`.
- **Reconstruct:** build the tree from `parentSpanId` links + `gen_ai.*` semantic-convention attributes.
  - Map `gen_ai.operation.name` (`chat`, `execute_tool`, `invoke_agent`, `create_agent`) → node `kind`.
  - Extract `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, prompt/completion from span events or attributes (support both buffered-content and event-based content capture — the spec allows both).
  - Compute derived fields: duration (end−start), token totals, rough cost (pluggable price table; default to "unknown" if model not in table — do NOT hardcode prices that go stale).
  - Be defensive: GenAI agent/framework span conventions are **experimental**. Unknown operations become a generic `step` node rather than throwing. Never lose a span — orphans attach to a synthetic root.
- **Serialize:** `Run` ↔ `.jsonl` session file (stable, versioned schema with a `schemaVersion` field).
- **Diff:** given two `Run`s or two `LlmCall`s, produce a structural diff (added/removed/changed steps; text diff of prompts/completions).

Key exports: `parseOtlp()`, `buildRun()`, `serializeRun()` / `parseRun()`, `diffRuns()`, `diffCalls()`, all types.

Tests: golden-file tests using `@agentscope/fixtures`. At least one fixture per supported framework shape (raw OpenAI/Anthropic SDK instrumentation, LangChain, one generic). Edge cases: orphan spans, missing token attrs, out-of-order span arrival, unknown operation name.

### 4.2 `@agentscope/cli`
The public face. `npx @agentscope/cli` must Just Work.

Responsibilities:
- Start a local **OTLP/HTTP receiver** on `:4318` (configurable) accepting `POST /v1/traces` (protobuf + JSON content types). This is the drop-in: users set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`.
- Buffer incoming spans per trace; on trace completion (or idle timeout) call `core.buildRun()` and append to the active `.jsonl` session.
- Serve the **pre-built UI** static assets + a small JSON API the UI reads (`GET /api/runs`, `GET /api/runs/:id`, `GET /api/diff?a=..&b=..`). API delegates entirely to `core`.
- Open the browser to the local UI on start.
- Subcommands:
  - `agentscope` / `agentscope live` — receiver + UI (default).
  - `agentscope open <file.jsonl>` — load a saved session, serve UI, no receiver (the "drag a run to a coworker" loop).
  - `agentscope --port <n> --no-open --out <dir>` flags.
- Built with a tiny HTTP layer (native `node:http` or a minimal framework — keep deps lean so `npx` is fast). Bundle with `tsup`/esbuild to a single runnable file. UI assets copied from `@agentscope/ui` build output at package time (Nx target dependency).

Tests: integration — boot the server on an ephemeral port, POST a fixture OTLP payload, assert `/api/runs/:id` returns the expected tree.

### 4.3 `@agentscope/ui`
React + Vite. This is the demo that spreads — make it clean. **Consult the frontend-design skill for styling/quality.** No backend logic; reads the CLI's JSON API and uses `core` types.

Four views (all v1):
1. **Run list** — sidebar of runs in the session, with task summary, duration, total tokens/cost, status.
2. **Execution tree** — collapsible run → step → LLM/tool hierarchy. Inline latency + token cost per node. Color/icon by node kind. This is the centerpiece screenshot.
3. **Inspector panel** — selected node detail: full prompt, completion, tool args/result (pretty-printed JSON), tokens, cost, model, timing.
4. **Diff view** — pick two runs or two LLM calls; side-by-side structural + text diff. This is the killer "worked yesterday" feature.
5. **Scrubber** — a timeline slider over the selected run's steps; dragging selects the node at that point in time. This *is* the "time travel."

Constraints: no localStorage/sessionStorage assumptions (the CLI serves data); keep state in React; handle empty state ("waiting for your first agent run…") gracefully since live mode starts empty.

### 4.4 `@agentscope/fixtures`
Sample OTLP request payloads (JSON) and recorded `.jsonl` sessions. Used by core/cli tests and as demo data (`agentscope open` on a fixture should produce a great-looking screenshot). Include at least: a happy-path multi-tool run, a run with a tool error, and two near-identical runs that differ in one decision (for the diff demo).

---

## 5. Build / ship order (each stage independently demoable — follow in order)

**Stage 1 — Capture.** Nx workspace + the three packages scaffolded. CLI starts the OTLP receiver and dumps raw spans to a `.jsonl` file. `core.parseOtlp()` done + tested. *Demo: "it captured my real agent's spans."*

**Stage 2 — Reconstruct.** `core.buildRun()` reconstructs the tree from `gen_ai.*` spans. CLI prints the tree to the terminal. Full core test suite green against fixtures. *Demo: terminal-printed decision tree.*

**Stage 3 — Inspect.** UI renders run list + execution tree + inspector, reading the CLI's JSON API. `agentscope open <file>` works. *Demo: the README screenshot.*

**Stage 4 — Time-travel + diff.** Scrubber + diff view. `core.diffRuns/diffCalls` done + tested. *Demo: the GIF for the launch post.*

Do not start a stage's UI work before its `core` functions are tested. Build `core` first within each stage.

---

## 6. Definition of done (v1)

- `pnpm install && npx nx run-many -t build test lint` is green from a clean clone.
- `npx @agentscope/cli` (or the local equivalent via `nx`) boots, receives a posted fixture, and shows the tree in the browser.
- `agentscope open libs/fixtures/...jsonl` renders a populated, good-looking UI with zero live input.
- Root `README.md`: the one-liner, the `npx` quickstart, a screenshot, the "point your OTLP endpoint here" instructions, and a clear "v1 scope / not yet" list.
- `changesets` configured; a GitHub Actions workflow runs build+test+lint on PR and publishes on tag with `--access public`.
- Each package has its own README and passing tests.

---

## 7. Explicitly OUT of scope for v1 (do not build)

Replay-execution (re-running the agent), cloud sync, auth/multi-user, eval scoring,
multi-agent topology graphs, gRPC ingest, SQLite persistence, a hosted version, VS Code
extension. Note them in a `ROADMAP.md` as "later" so the boundary is visible, then leave them alone.

---

## 8. First actions for Claude Code

1. Confirm/replace the `@agentscope` name (see name check at top). If unconfirmed, ask the user.
2. Verify environment: Node version, pnpm installed.
3. Scaffold the Nx integrated monorepo with pnpm, then create the four packages with module-boundary tags.
4. Implement Stage 1 end to end (capture), with tests, before moving on.
5. After each stage, run `nx run-many -t build test lint` and report status before proceeding.