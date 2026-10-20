import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The UI package has its own node_modules; resolve its bridge to the same module id the test mocks.
      '@forge/bridge': fileURLToPath(new URL('./static/main/node_modules/@forge/bridge', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
