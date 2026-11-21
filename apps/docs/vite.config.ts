import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// The browser calls the backend on its own origin (CORS): VITE_TAROL_API, default the sample's API on :5080, which
// allows this app's origin http://localhost:5173. No proxy.
// VITE_TAROL_PAGES=1 is the GitHub Pages build (SV-21): the catalogue only, relative asset paths for the project URL.
export default defineConfig({
  plugins: [svelte()],
  base: process.env['VITE_TAROL_PAGES'] === '1' ? './' : '/',
  build: { target: 'es2022' },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
