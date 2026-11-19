import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'tarol-client', include: ['test/**/*.test.ts'], environment: 'node' },
});
