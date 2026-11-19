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
| size-limit | a budget of 1 byte | `Package size limit has exceeded by 1.96 kB`, exit 1 [verified] | step 2 |
| publint | an `exports` target that does not exist | `pkg.exports["./push"].default is ./dist/missing.js but the file does not exist`, exit 1 [verified] | step 2 |
| API Extractor | a changed public function without `api:update` | `You have changed the API signature for this project`, exit 1 [verified] | step 2 |

`pnpm verify` runs the whole list locally (not `pnpm ci`, which is pnpm's own command).

## After the merge (2026-11-19)

* **Build before lint.** On a fresh clone `pnpm verify` failed: type-aware lint resolves the `@clorat/*` workspace imports
  through each package's `dist/`, which does not exist before `pnpm build`, so 302 `no-unsafe-*` errors in 20 files
  [verified: `rm -rf packages/*/dist && pnpm verify` on `main@6d672da`, exit 1]. The previous session's checkouts had
  stale `dist/` folders, which hid it. `verify` and `ci.yml` now run `build` before `lint`; the same clean run passes:
  12 test files, 94 tests passed, 8 skipped (the contract tests without `TAROL_E2E`), size, package checks, API reports
  and 9 eng tests [verified].
* **GitHub CI has never run in this repository.** Every run of `ci.yml` and `codeql.yml` (28 runs, all PRs and pushes to
  `main`) ends after 3-4 s as `failure` with no steps and no runner assigned (`runner_id: 0`, empty check output). The same
  workflows' actions run in `CLorat/Tarol-Net`, which is public; this repository is private, where Actions spends the
  account's minutes. A job refused before a runner is assigned on every run, CodeQL included, is what an exhausted Actions
  allowance or a spending limit of 0 looks like [verified: run and job metadata; the cause is **unverified**, the
  annotation is only visible in the web UI]. The owner checks *Settings → Billing → Actions* (or makes the repository
  public); no commit can fix it. Until then every PR records its local `pnpm verify` run.

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
