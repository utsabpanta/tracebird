import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  // Bundle our own modules into one file; keep node_modules deps external so
  // `npx` resolves them normally (protobufjs has dynamic requires). The private
  // fixtures package is inlined so `demo` ships sample data with no runtime dep.
  noExternal: ['@tracebird/fixtures'],
  banner: { js: '#!/usr/bin/env node' },
  dts: false,
});
