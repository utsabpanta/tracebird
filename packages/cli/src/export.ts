import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeSession, type Run } from '@tracebird/core';
import { SessionStore } from './storage/session-store.js';

/**
 * Shareable-run export. Two formats:
 *  - `jsonl` — the run(s) as a session file (re-openable with `tracebird open`).
 *  - `html`  — a single self-contained page that inlines the UI bundle + the run
 *    data, so a coworker can open it offline with no install.
 */

export function exportJsonl(runs: Run[]): string {
  return serializeSession(runs);
}

function inlineAssets(uiDir: string, html: string): string {
  const withJs = html.replace(
    /<script\b[^>]*\bsrc="(\.?\/?assets\/[^"]+\.js)"[^>]*><\/script>/g,
    (_match, src: string) => {
      const code = readFileSync(join(uiDir, src.replace(/^\.?\//, '')), 'utf8').replace(
        /<\/(script)/gi,
        '<\\/$1',
      );
      return `<script type="module">${code}</script>`;
    },
  );
  return withJs.replace(
    /<link\b[^>]*\bhref="(\.?\/?assets\/[^"]+\.css)"[^>]*>/g,
    (_match, href: string) => {
      const css = readFileSync(join(uiDir, href.replace(/^\.?\//, '')), 'utf8');
      return `<style>${css}</style>`;
    },
  );
}

/** Produce a self-contained HTML snapshot of the given runs. */
export function buildHtmlSnapshot(uiDir: string, runs: Run[]): string {
  const store = new SessionStore();
  for (const run of runs) store.addRun(run, { persist: false });

  const snapshot = {
    session: { live: false, filePath: null, count: runs.length },
    runs: store.list(),
    runsById: Object.fromEntries(runs.map((r) => [r.id, r])),
  };
  // Escape `</` so the JSON can't break out of the <script> element.
  const json = JSON.stringify(snapshot).replace(/<\//g, '<\\/');
  const inject = `<script>window.__TRACEBIRD_SNAPSHOT__=${json}</script>`;

  const html = inlineAssets(uiDir, readFileSync(join(uiDir, 'index.html'), 'utf8'));
  if (html.includes('<script type="module">')) {
    return html.replace('<script type="module">', `${inject}<script type="module">`);
  }
  return html.replace('</head>', `${inject}</head>`);
}
