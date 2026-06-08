# @tracebird/ui

The React/Vite front-end for [tracebird](../../README.md) — the demo that
spreads. It reads the CLI's JSON API and renders the agent run for inspection.

No backend logic lives here: data comes from `@tracebird/cli`'s API, and the
shared types come from [`@tracebird/core`](../core/README.md).

## Views (v1)

1. **Run list** — runs in the session with summary, duration, tokens, cost.
2. **Execution tree** — collapsible run → step → LLM/tool hierarchy.
3. **Inspector** — full prompt, completion, tool args/result, tokens, timing.
4. **Diff view** — side-by-side structural + text diff of two runs/calls.
5. **Scrubber** — a timeline slider that selects the node at a point in time.

> Stages 3–4 implement the views; Stage 1 ships the app shell + empty state.

## Develop

```sh
npx nx dev ui     # vite dev server, proxying /api to a running CLI on :4318
npx nx build ui   # static assets, bundled into the CLI at package time
npx nx test ui
```
