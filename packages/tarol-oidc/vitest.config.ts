import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'tarol-oidc', include: ['test/**/*.test.ts'], environment: 'node' },
});
