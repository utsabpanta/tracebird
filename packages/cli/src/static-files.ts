import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Serve the pre-built UI static assets from `rootDir`, with SPA fallback to
 * `index.html`. Returns false if `rootDir` doesn't exist (UI not bundled).
 */
export function serveStatic(
  rootDir: string,
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  if (!existsSync(rootDir)) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // Resolve within rootDir; reject path traversal.
  const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(rootDir, rel);
  if (!filePath.startsWith(rootDir)) filePath = join(rootDir, 'index.html');

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(rootDir, 'index.html'); // SPA fallback
  }
  if (!existsSync(filePath)) return false;

  const type = MIME[extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(filePath).pipe(res);
  return true;
}
