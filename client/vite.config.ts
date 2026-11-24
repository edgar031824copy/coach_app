import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// `shared` is imported from source, so the client builds (here and in the deploy workflow) without building it first.
// In development the browser talks to the server through this proxy, so no CORS is involved; a deployed client calls
// the server's own URL (VITE_API_URL).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      shared: fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
});
