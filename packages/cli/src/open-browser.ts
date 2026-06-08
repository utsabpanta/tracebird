import { spawn } from 'node:child_process';

/** Best-effort: open a URL in the user's default browser. Never throws. */
export function openBrowser(url: string): void {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // Headless environment, etc. — the URL is printed for the user anyway.
  }
}
