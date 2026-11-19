import { existsSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Each package brings its own vitest.config.ts (unit tests in Node, component tests in Chromium through Vitest browser
// mode). Timing tests use fake timers, never the wall clock (plan.md, lessons).
const projects = existsSync('packages')
  ? readdirSync('packages')
      .map((d) => `packages/${d}/vitest.config.ts`)
      .filter((f) => existsSync(f))
  : [];

export default defineConfig({
  test: projects.length > 0 ? { projects } : { include: [], passWithNoTests: true },
});
