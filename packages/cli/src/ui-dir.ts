import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locate the pre-built UI assets. In the published package they sit next to the
 * bundled `cli.js` at `dist/ui`; in the dev tree they're at `packages/ui/dist`.
 */
export function resolveUiDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'ui'), // dist/ui (published / built)
    join(here, '..', '..', 'ui', 'dist'), // packages/cli/dist → packages/ui/dist
  ];
  return candidates.find((dir) => existsSync(join(dir, 'index.html'))) ?? candidates[0];
}
