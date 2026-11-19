# Step 1: foundation

## What it sets up

* **Workspace**: pnpm 10.28 workspaces (`packages/*`, `apps/docs`), one lockfile, `pnpm-workspace.yaml` with
  `onlyBuiltDependencies: []` (no install scripts run, SV-13), Node 22 (`.nvmrc`, `engines`).
* **TypeScript**: one `tsconfig.base.json` with `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, `isolatedDeclarations` where possible; `svelte-check` for `.svelte` files.
* **Lint and format**: ESLint flat config (typescript-eslint strict-type-checked, eslint-plugin-svelte), `--max-warnings 0`;
  Prettier with `prettier-plugin-svelte`; `@typescript-eslint/no-explicit-any` is an error.
* **Tests**: Vitest (unit, Node), Vitest browser mode with `@vitest/browser` + Playwright's Chromium (components); axe-core.
* **Package checks**: `size-limit` (SV-15), `publint`, `@arethetypeswrong/cli`, API Extractor (`pnpm api:update` writes the
  reports; CI runs `api:check`), `eng/check-deps.mjs` (allowed runtime dependencies and the package graph).
* **CI** (`.github/workflows/ci.yml`, reusable via `workflow_call`): install with `--frozen-lockfile`, format check, lint,
  type-check, unit and component tests, build, size, package shape, API reports. Actions pinned to full commit SHAs with
  the tag as a comment, `persist-credentials: false`; Dependabot for npm and actions; CodeQL for JavaScript/TypeScript
  (`security-extended`).
* **Repository files**: `AGENTS.md` (+ `CLAUDE.md`, `.github/copilot-instructions.md` pointing to it), PR template,
  `CHANGELOG.md`, `SECURITY.md`, `.editorconfig`, `.gitignore`.

## Proving the checks work

Each check gets a deliberate violation once, in a throw-away commit or a test, and the failure is recorded in the PR:
an `any` in a public type (lint), a budget of 1 byte (size-limit), a missing `exports` entry (publint), an unlisted
dependency (check-deps), a changed public function without `api:update` (API Extractor).

## Dev dependencies (all dev only; decided with SV-13)

Versions, licences and sizes are recorded in [dependencies.md](dependencies.md) when the PR adds them.
