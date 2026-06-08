import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi, type ApiContext } from './api.js';
import { serveStatic } from './static-files.js';

/**
 * Build the combined UI/API request handler passed to the server as its
 * `extraHandler`: API routes first, then the static UI (with SPA fallback).
 */
export function createAppHandler(ctx: ApiContext, uiDir: string) {
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    if (handleApi(ctx, req, res)) return true;
    if (serveStatic(uiDir, req, res)) return true;
    return false;
  };
}
