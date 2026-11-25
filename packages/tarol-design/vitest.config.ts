import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import type { BrowserCommand } from 'vitest/node';
import { defineConfig } from 'vitest/config';

/** `prefers-reduced-motion` for the motion tests (TS-35); Playwright emulates it for the page and its frames. */
const reducedMotion: BrowserCommand<['reduce' | 'no-preference']> = async (context, value) => {
  if (context.provider.name !== 'playwright') throw new Error('reducedMotion needs the playwright provider');
  await context.page.emulateMedia({ reducedMotion: value });
};

export default defineConfig({
  plugins: [svelte()],
  test: {
    name: 'tarol-design',
    include: ['test/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
      commands: { reducedMotion },
    },
  },
});
