import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests import `shared` from source, so they do not need a build first (same as the server's).
export default defineConfig({
  resolve: { alias: { shared: fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) } },
});
