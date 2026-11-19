import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'tarol-codegen', include: ['test/**/*.test.ts'], environment: 'node' },
});
