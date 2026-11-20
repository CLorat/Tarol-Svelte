import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// The browser calls the backend on its own origin (CORS, BC-1): VITE_TAROL_API, default the sample's API on :5080, which
// allows this app's origin http://localhost:5173. No proxy.
export default defineConfig({
  plugins: [svelte()],
  build: { target: 'es2022' },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
