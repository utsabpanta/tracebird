import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Built assets are bundled into the CLI and served from its root.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // During `vite dev`, proxy API calls to a locally-running CLI receiver.
    proxy: {
      '/api': 'http://localhost:4318',
    },
  },
});
