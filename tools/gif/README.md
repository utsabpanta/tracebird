# GIF capture (dev tooling)

Regenerates `docs/demo.gif` — the README hero showing the scrubber + diff.

Pure Node: drives the installed Google Chrome with `puppeteer-core`, screenshots
frames, and encodes them with `gifenc` (no ffmpeg / ImageMagick needed).
Standalone pnpm project (isolated from the monorepo).

```sh
cd tools/gif
pnpm install
./run-capture.sh          # builds the CLI, serves a curated session, writes docs/demo.gif
```

Overrides via env: `PORT`, `CHROME_PATH`, `OUT`, `TB_URL`.

`run-capture.sh` serves a multi-tool weather run plus the two support-triage
diff-pair runs, then `capture.mjs` selects the weather run, steps across the
timeline, and switches to the diff view.
