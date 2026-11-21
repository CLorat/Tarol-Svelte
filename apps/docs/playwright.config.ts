import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the ArtFlow sample of Tarol-Net (docs/migration/e2e.md). The app is the production build,
// served by `vite preview` on http://localhost:5173; it calls the sample's API on its own origin (CORS).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'off', ...devices['Desktop Chrome'] },
  // artflow needs the backend sample; the catalogue and its screenshots run on the in-memory demo client
  projects: [
    { name: 'sample', testMatch: /sample\.setup\.ts/, teardown: 'sample teardown' },
    { name: 'sample teardown', testMatch: /sample\.teardown\.ts/ },
    { name: 'artflow', testMatch: /artflow\.spec\.ts/, dependencies: ['sample'] },
    { name: 'catalogue', testMatch: /catalogue\.spec\.ts/ },
    // SV-21: the GitHub Pages build (VITE_TAROL_PAGES=1, which the webServer's build inherits)
    { name: 'pages', testMatch: /pages\.spec\.ts/ },
    // SV-12: baselines are made in the Linux CI container only (fonts and rendering differ elsewhere)
    { name: 'visual', testMatch: /visual\.spec\.ts/, snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}' },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec vite preview',
    env: { VITE_TAROL_API: process.env['TAROL_E2E_URL'] ?? 'http://localhost:5080' },
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
