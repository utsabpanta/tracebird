// Copy the pre-built UI assets into the CLI's dist so they ship with the package
// and are served at runtime from `dist/ui`.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const uiDist = join(cliRoot, '..', 'ui', 'dist');
const target = join(cliRoot, 'dist', 'ui');

if (!existsSync(uiDist)) {
  console.error(`copy-ui: UI build not found at ${uiDist}. Run \`nx build ui\` first.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(uiDist, target, { recursive: true });
console.log(`copy-ui: copied UI assets → ${target}`);
