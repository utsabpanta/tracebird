import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@tracebird/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@tracebird/fixtures': fileURLToPath(
        new URL('../../libs/fixtures/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
