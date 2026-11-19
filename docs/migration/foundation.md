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

Each check gets a deliberate violation once, and the failure is recorded:

| Check | Violation | Result | Where |
|---|---|---|---|
| ESLint | `export function f(x: any): any` | 2 errors `@typescript-eslint/no-explicit-any` [verified] | this PR |
| Prettier | `const  x =1` | `Code style issues found` [verified] | this PR |
| `eng/check-deps.mjs` | undecided dependency, an edge outside the graph, CommonJS, no `sideEffects`, another licence, an unknown package | 6 tests in `eng/tests/check-deps.test.mjs`, all pass [verified] | this PR |
| size-limit | a budget of 1 byte | | step 2 (the first package) |
| publint / attw | a missing `exports` target | | step 2 |
| API Extractor | a changed public function without `api:update` | | step 2 |

`pnpm verify` runs the whole list locally (not `pnpm ci`, which is pnpm's own command).

## Choices made while building it

* **TypeScript 6.0.3, not 7.0.2.** TypeScript 7 is the latest release, but `typescript-eslint` 8.73.0 declares
  `typescript >=4.8.4 <6.1.0`, `svelte-check` 4.7.8 `^5 || ^6`, and API Extractor 7.60.1 bundles 6.0.3 [verified by
  `npm view … peerDependencies`]. Revisit when they support 7.
* **Playwright 1.63.0**, the version whose Chromium (build 1243) is preinstalled in the cloud sessions; CI installs the
  browser of the locked version. Dependabot updates it.
* **No third-party action**: pnpm comes from Node's corepack (`packageManager` in `package.json`), so only `actions/*` and
  `github/*` actions are used, pinned to full SHAs (same pins as Tarol-Net; `actions/setup-node` v7.1.0 =
  `949feb2413d6458794dcd2491c4babbbce0c15c1`, resolved with `git ls-remote`).
* `vitest.config.ts` lists only packages that have a `vitest.config.ts`, so the workspace runs with no package.

## Dev dependencies (all dev only; decided with SV-13)

Versions, licences and sizes are recorded in [dependencies.md](dependencies.md) when the PR adds them.
