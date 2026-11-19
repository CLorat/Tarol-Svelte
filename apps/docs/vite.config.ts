import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// The browser talks to the backend through `/api` on its own origin: the dev server proxies it to the sample's API, so
// no CORS is needed (BC-1 is not in the backend yet). TAROL_E2E_URL points elsewhere (default: the AppHost's :5080).
const api = process.env['TAROL_E2E_URL'] ?? 'http://localhost:5080';

export default defineConfig({
  plugins: [svelte()],
  build: { target: 'es2022' },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: api, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  preview: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: api, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
});
