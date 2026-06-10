// Capture a demo GIF of the tracebird UI: select a run, scrub the timeline,
// then switch to the diff view. Pure Node — drives the installed Chrome via
// puppeteer-core and encodes frames with gifenc (no ffmpeg/ImageMagick needed).
//
// Expects a tracebird UI already serving at TB_URL with a weather run + the two
// support-triage diff-pair runs loaded (see run-capture.sh).

import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const TB_URL = process.env.TB_URL ?? 'http://localhost:4318';
const OUT = process.env.OUT ?? 'demo.gif';
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1000;
const H = 620;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-color-profile=srgb', `--window-size=${W},${H}`],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  // Don't wait for network idle — the SSE stream keeps a connection open.
  await page.goto(TB_URL, { waitUntil: 'load' });
  await page.waitForSelector('.run-item', { timeout: 15000 });

  const frames = [];
  const grab = async (delay = 700, repeat = 1) => {
    const png = PNG.sync.read(Buffer.from(await page.screenshot({ type: 'png' })));
    for (let i = 0; i < repeat; i++) frames.push({ data: png.data, w: png.width, h: png.height, delay });
  };

  // 1. Select the multi-tool weather run.
  await page.evaluate(() => {
    const item = [...document.querySelectorAll('.run-item')].find((e) =>
      /Paris/.test(e.textContent || ''),
    );
    item?.click();
  });
  await page.waitForSelector('.tree-row');
  await sleep(500);
  await grab(1200);

  // 2. Time-travel: step across the scrubber ticks.
  const ticks = await page.$$('.scrubber-tick');
  for (const tick of ticks) {
    await tick.click();
    await sleep(300);
    await grab(750);
  }
  await grab(900);

  // 3. Switch to the diff view (defaults to the two triage runs → P1 vs P2).
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.mode-toggle button')].find((e) =>
      /Diff/.test(e.textContent || ''),
    );
    btn?.click();
  });
  await page.waitForSelector('.diff-node', { timeout: 5000 }).catch(() => undefined);
  await sleep(900);
  await grab(2200, 2);

  // Encode.
  const enc = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.data, 256);
    const index = applyPalette(f.data, palette);
    enc.writeFrame(index, f.w, f.h, { palette, delay: f.delay });
  }
  enc.finish();
  writeFileSync(OUT, Buffer.from(enc.bytes()));
  console.log(`wrote ${OUT} — ${frames.length} frames`);
} finally {
  await browser.close();
}
