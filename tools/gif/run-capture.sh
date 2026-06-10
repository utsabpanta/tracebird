#!/usr/bin/env bash
# Build the CLI, serve a curated session (a multi-tool run + the diff pair),
# capture the GIF, and write it to docs/demo.gif.
#
#   cd tools/gif && pnpm install && ./run-capture.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PORT:-4318}"

cd "$ROOT"
npx nx run cli:build >/dev/null

OUTDIR="$(mktemp -d)"
node packages/cli/dist/cli.js live --out "$OUTDIR" --no-open --port "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true; rm -rf "$OUTDIR"' EXIT
sleep 1.5

node --input-type=module -e "
import { weatherHappyPath, diffPairA, diffPairB } from '$ROOT/libs/fixtures/dist/index.js';
for (const b of [weatherHappyPath, diffPairA, diffPairB])
  await fetch('http://localhost:$PORT/v1/traces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
"
sleep 2.2

cd "$ROOT/tools/gif"
TB_URL="http://localhost:$PORT" OUT="$ROOT/docs/demo.gif" node capture.mjs
echo "✓ docs/demo.gif"
