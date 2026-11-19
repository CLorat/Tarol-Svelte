import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Runes and component tests run in a real Chromium (SV-12): focus, visibility and timers behave as in an app.
export default defineConfig({
  plugins: [svelte()],
  test: {
    name: 'tarol-svelte',
    include: ['test/**/*.test.ts'],
    browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: 'chromium' }] },
  },
});
