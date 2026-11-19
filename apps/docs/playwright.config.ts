import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the ArtFlow sample of Tarol-Net (docs/migration/e2e.md). The app is the production build,
// served by `vite preview`, which proxies /api to the sample's API (same origin until BC-1).
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'off', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'pnpm exec vite build --logLevel warn && pnpm exec vite preview',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
