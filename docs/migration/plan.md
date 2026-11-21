# Plan: tarol-svelte

tarol-svelte is new, so there is nothing to migrate. Its "migration" is from the backend contract to a browser client,
one package family per step, built the way Tarol-Net was: a design session first (this PR), owner decisions
([decisions.md](decisions.md), prefix **SV-**), then small PRs with a measured choice each.

The backend is `CLorat/Tarol-Net@main`, verified on 2026-11-19 at `73b35ff`:
* step 17 (release) is merged, including 17F; step 18 (global search) is merged (#78, #82, #83);
* `v0.1.0-preview.1` is **published** as a GitHub pre-release (2026-11-18T14:06:55Z);
* 29 packable projects (28 packages plus the meta-package `Tarol`), 106 test projects with 1,463 `[Fact]`/`[Theory]`
  attributes, and 28 AOT smoke apps (counted by `find`/`grep` in `src` and `tests` [verified]);
* the sample `samples/Sagas` builds with SDK 11.0.100 and starts through its Aspire AppHost in this session's container
  (PostgreSQL 18.3, NATS 2.14, Zitadel v4.20.3; `/health/ready` 200) [verified].

## Status

| # | Step | Packages | Evaluation | Waits for | Status |
|---|---|---|---|---|---|
| 0 | Design | — | this file, [philosophy](../architecture/philosophy.md), [overview](../architecture/overview.md), [backend changes](../backend/changes.md) | — | merged (#1) |
| 1 | Foundation | workspace, CI, release skeleton | [foundation.md](foundation.md) | — | merged (#2): pnpm workspace, TS 6 strict, ESLint/Prettier, Vitest, check-deps (6 tests), CI, CodeQL, Dependabot |
| 2 | Client core | `@clorat/tarol-client` (+ `/push`) | [client.md](client.md) | BC-2 for push against a real hub | merged (#3): 36 unit + 6 contract tests against the sample, core 1.96 KB, push 1.35 KB gzip |
| 3 | Svelte bindings | `@clorat/tarol-svelte` | [svelte.md](svelte.md) | — | merged (#4): `query`, `list`, `changeForm`, `live`; 25 tests in Chromium; 2.62 KB gzip compiled; optimistic changes follow with step 4 |
| 4 | Design system and first components | `@clorat/tarol-design`, `@clorat/tarol-components` (`DataTable`, form fields, `Dialog`, `Toaster`, `QueryState`, `AppShell`) | [design.md](design.md) | — | merged (#5): tokens + 10 primitives + 5 components, 21 tests in Chromium with axe (0 violations), contrast and literal-text checks; visual regression moves to step 9 |
| 5 | Typed client generator | `@clorat/tarol-codegen` | [codegen.md](codegen.md) | BC-3 for exact types, BC-4 for rules | merged (#6): 12 unit + 2 contract tests; the live document generates the committed snapshot; 489 B gzip for 6 entries |
| 6 | Auth | `@clorat/tarol-oidc` (+ `/zitadel`) | [oidc.md](oidc.md) | BC-9 (a PKCE app in the sample) for e2e | built (PR 6): `createOidc` + `/zitadel`; 29 unit + 3 contract tests; 7.77 KB gzip (8.19 KB with the preset); browser login against Zitadel waits for BC-9 |
| 7 | More components | combobox, menu, tabs, date field, search box, detail layout | [design.md](design.md) §7 | BC-8 for search | part 1 built (PR 7a): `Combobox`, `MenuButton`, `Tabs`, `DateField`; 11 tests in Chromium, axe 0; Combobox budget 3 KB (2.99 KB). Part 2 built (PR 7b): `DataTable` grid keys, `DetailLayout`, `SearchBox` (titles only until BC-8), optimistic `changeForm`; 7 + 7 tests |
| 8 | End-to-end | Playwright against `samples/Sagas`; INP, CLS; visual regression (SV-12) | [e2e.md](e2e.md) | BC-1, BC-2, BC-9 | built (PR 8): `apps/docs` example screens + Playwright against the sample: 7 scenarios pass, push is `fixme` (BC-2, BC-9); INP 16–24 ms, CLS 0; CI job `e2e` |
| 9 | Docs app | own Svelte + Vite catalogue (SV-11), runnable examples, GitHub Pages | [docs-app.md](docs-app.md) | — | built (PR 9): 21 component pages (live example, source, props from the types, keys), tokens, 5 guides; 58 catalogue tests (axe, CLS) in both themes; visual job with 84 screenshots, baselines from the CI container (none yet: no runner) |
| 10 | Admin UI | `@clorat/tarol-admin` | [admin.md](admin.md) | BC-10 | **blocked** (BC-10 not landed): the admin entry answers free text, empty 404s and a 500 on erase [verified]; admin.md "Status" |
| 11 | Release | `release.yml`, first tag by the owner | [release.md](release.md) | — | built (PR 11): `release.yml` (ci → pack → publish behind `release`, dry runs otherwise), `eng/release.mjs` with 6 tests; the first tag is the owner's |
| 12 | Backend fixes | adopt Tarol-Net #91 (BC-1 … BC-17), remove the client's limitations, build step 10 | [backend-fixes.md](backend-fixes.md) | BC-18 (browser login in the sample) | in progress: PR 0 (this note, SV-16 … SV-18) |

Order: each step only needs the ones before it. Steps 2–5 are the first build PRs (definition of done of the design
session). The docs app starts small in step 4 (a page per component, used by the axe and screenshot tests) and becomes
the full catalogue in step 9.

## How a step is done

Definition of done for every package (the counterpart of Tarol-Net's conventions §8):

1. **Note**: `docs/migration/<step>.md` records the inventory, the candidates with measurements, the decisions, every
   public API or behaviour change, every suppression with its reason, and the verification output.
2. **Code**: TypeScript `strict` (plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`); no `any` in public types;
   ESLint and Prettier clean with warnings as errors; no suppression without a reason in the note.
3. **Public API**: the API Extractor report (`packages/<pkg>/api/<pkg>.api.md`) is generated by `pnpm api:update`, never
   written by hand; CI fails when it differs from the build.
4. **Tests**: unit (Vitest), component tests in a real browser (Vitest browser mode, Chromium) with axe, and type tests;
   counts in the note.
5. **Size**: `size-limit` budgets met (SV-15); the numbers in the note.
6. **Package shape**: `publint` and `attw` clean; ESM only; `sideEffects` set; `exports` for each entry.
7. **README** (npm readme) and **skill** `packages/<pkg>/skills/tarol-<topic>/SKILL.md` (shipped in the tarball), plus an
   evaluation checklist for the skill in the note.
8. **Docs**: CHANGELOG `[Unreleased]`, plan status, and the docs app page when the package has UI.
9. **Verification recorded** in the PR: lint, type-check, unit and component tests (counts), size budgets, e2e against the
   sample (once step 8 exists), build of every package.

## Pull requests

* One clear feature per PR: one step, or one self-contained part of it. Title `<area>: <what>`.
* The body follows `.github/pull_request_template.md` (added in step 1; a copy of Tarol-Net's with the frontend checks and
  one line per principle in [philosophy.md](../architecture/philosophy.md)).
* **Stacked PRs**: when PR B is based on PR A's branch, retarget B to `main` **before** A is merged (Tarol-Net step 17:
  two PRs landed in their base branches by mistake).
* Commits are small, with an imperative subject (`client: map problems to violations`) and a body that explains why.
* The session never merges, never creates tags, never publishes to the public npm registry, and never changes the licence.

## Lessons carried over from Tarol-Net

* **Edits by script** assert every anchor (`assert old in s`).
* **A flaky test that fails twice is a bug**: reproduce it deterministically first (the SignalR reconnect flake was the
  restart-loop bug #71).
* **Timing tests** wait for events, never for a wall clock (fake timers in Vitest, `expect.poll` in Playwright).
* **Public API reports** are generated by the tool.
* **The session's worker restarts and kills background jobs**: commit and push after every green step; long work runs
  through a resumable script with a marker file per step, started with `setsid nohup`. (Seen twice in the design session:
  the Docker daemon and an AppHost were killed.)
* **Publishing**: a package name already linked to another repository gets a 403 on publish; check names before the first
  tag (SV-14: none exist yet).
