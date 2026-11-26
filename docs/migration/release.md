# Step 11: release

The same model as Tarol-Net step 17 (`docs/architecture/release.md` there), decided by SV-14:

* `release.yml` on tag `v*` (tags are pushed by the owner only): re-run `ci.yml` (`workflow_call`) → `pack` (build every
  package, size budgets, API Extractor check, `publint`/`attw`, versions equal to the tag, `CHANGELOG.md` has the version,
  notes from it) → `publish` behind the environment `release` (owner approval), `npm publish` to
  `https://npm.pkg.github.com` with `GITHUB_TOKEN` (`packages: write`), then `gh release create --verify-tag`.
  Pull requests and manual runs are dry runs that stop before `publish`.
* The tag must be on `main`. Never the public npm registry.
* Consumers need an `.npmrc` with `@clorat:registry=https://npm.pkg.github.com` and a token with `read:packages`, even
  for public packages (GitHub Packages requires authentication for installs [verified by reading GitHub's docs via search,
  not tried]).
* No `@clorat/tarol-*` npm package exists yet (owner, SV-14), so the first publish cannot hit the "name linked to another
  repository" 403 from Tarol-Net's step 17.

## Built (step 11)

* `.github/workflows/release.yml`: `ci` (`uses: ./.github/workflows/ci.yml`: build, lint, types, tests, budgets, package
  checks, API reports, e2e, visual) → `pack` → `publish`. Triggers: a tag `v*` publishes; `workflow_dispatch` and pull
  requests that change the release files are dry runs that stop after `pack` (`publish` runs only on a tag push).
* `pack`: the tag must be on `main` (`git merge-base --is-ancestor`); `eng/release.mjs version` turns the tag into the
  version (`v0.1.0-preview.1` → `0.1.0-preview.1`, anything else fails) and `set-version` writes it into every
  publishable `package.json`; then build, `pnpm size` (SV-15), `api:check`, `check:packages` (publint, attw, check-deps),
  `eng/release.mjs check` (scope `@clorat/tarol-*`, the version, AGPL, `publishConfig.registry` =
  `https://npm.pkg.github.com`, README, a shipped skill, and `## [<base version>]` in `CHANGELOG.md`; a dry run warns
  instead), `pnpm pack` of each package (pnpm resolves the internal `workspace:*` ranges to the version), the notes from
  the CHANGELOG section with the consumer's `.npmrc`, and the artifact `release`.
* `publish` (environment `release`, `packages: write`, `contents: write`): `npm publish` of exactly the tarballs `pack`
  verified, with `GITHUB_TOKEN`; a version already on the feed is skipped, so a re-run after a later failure is safe;
  pre-releases get the dist-tag `next`. Then `gh release create --verify-tag` with the notes.
* Pins: the same action SHAs as Tarol-Net (`checkout`, `setup-node`, `upload-artifact`, `download-artifact`; since
  2026-11-21 `upload-artifact` v7.0.2 and `download-artifact` v8.0.2, foundation.md "Node 24 actions").

**Verification** [verified locally; the workflow itself cannot run, no job of this repository gets a runner]:
* `eng/tests/release.test.mjs`: **6** tests (tags, the CHANGELOG section, a complete release and a pre-release, every
  missing piece reported as a deliberate violation, private packages skipped, the notes and their dry-run fallback), part
  of `pnpm eng:test`.
* A rehearsal of the tag path: `version v0.1.0-preview.1`, `set-version`, build, `pnpm pack` of the 6 packages: each
  tarball has the version, `@clorat/tarol-components` depends on `@clorat/tarol-design`, `-svelte`, `-client` at
  `0.1.0-preview.1`, and `@clorat/tarol-oidc`'s tarball has `README.md`, `LICENSE` and `skills/tarol-oidc/SKILL.md`; the
  versions were restored afterwards. `check 0.1.0 --dry-run` passes; without `--dry-run` it fails on the missing
  `## [0.1.0]` section, which the owner writes with the release.

**What the owner does for the first release**: make Actions run in this repository (foundation.md); create the
environment `release` with a required reviewer; move `[Unreleased]` to `## [0.1.0] - <date>` in `CHANGELOG.md` on `main`;
push the tag `v0.1.0` (or `v0.1.0-preview.1`). Never the public npm registry.

## The Tag workflow (2026-11-21, SV-20)

As in Tarol-Net (`tag.yml`, `docs/architecture/release.md` §2.1 there): **Actions → Tag → Run workflow** on `main` with a
version such as `0.1.0-preview.2`. It checks that the version is valid and not tagged yet, runs `eng/release.mjs check`
on the versions the tag will give the packages (set in the runner only, not committed), creates the annotated tag
`v<version>` on `main`'s head and dispatches `release.yml` on it. A tag pushed with `GITHUB_TOKEN` starts no workflow, so
`release.yml`'s `publish` now runs for a `workflow_dispatch` on a `v*` tag as well as for a pushed tag; on a branch a
dispatch stays a dry run. `publish` still waits for the environment `release`.

The first version is **`0.1.0-preview.2`**, Tarol-Net's current release (SV-20); `CHANGELOG.md` has the `## [0.1.0]`
section a `0.1.0-*` pre-release uses. Verified locally: `release.mjs version v0.1.0-preview.2`, `set-version`, `check`:
7 packages, 0 problems; the notes list the 7 packages. The e2e job pins Tarol-Net `main` at `9b68afc` (BC-18 merged).

## The first release: `0.1.0-preview.2` (2026-11-21)

The owner ran **Actions → Tag** with `0.1.0-preview.2` on `main` at `c95baf9` (PR #26 merged) [verified: run data and
logs read through the GitHub API]:

* **Tag** run [#1](https://github.com/CLorat/Tarol-Svelte/actions/runs/44895670161) (10:43:12Z, 13 s): created the
  annotated tag `v0.1.0-preview.2` on `c95baf9` and dispatched `release.yml` on it.
* **Release** run [#8](https://github.com/CLorat/Tarol-Svelte/actions/runs/44895682409) (`workflow_dispatch` on the tag,
  10:43:22Z → 10:48:49Z, all green): `ci / build`, `ci / e2e` (Tarol-Net `9b68afc`), `ci / visual` (88 baselines), then
  `pack`, then `publish`.
* **Published** to GitHub Packages with the dist-tag `next`, each at `0.1.0-preview.2`: `@clorat/tarol-admin`,
  `@clorat/tarol-client`, `@clorat/tarol-codegen`, `@clorat/tarol-components`, `@clorat/tarol-design`,
  `@clorat/tarol-oidc`, `@clorat/tarol-svelte` (7 packages; each tarball lists its `skills/tarol-*/SKILL.md` in the
  `npm notice` output).
* **GitHub pre-release**: [tarol-svelte 0.1.0-preview.2](https://github.com/CLorat/Tarol-Svelte/releases/tag/v0.1.0-preview.2),
  notes from the `## [0.1.0]` section of `CHANGELOG.md`.

**`publish` did not wait for an approval**: the job was created at 10:48:27Z and started at 10:48:31Z, with no waiting
state between. The environment `release` has no required reviewer (or did not exist and was created by the run). The
owner adds one under Settings → Environments → `release` → Required reviewers before the next tag; until then any run of
Tag publishes without a second look.

## The consumer check (SV-23, 2026-11-21)

**By hand first**, on the published `0.1.0-preview.2`, in a scratch app outside the repository: an `.npmrc` with
`@clorat:registry=https://npm.pkg.github.com` and a token with `read:packages` (saved by the owner as a network secret of
the session's environment, never in chat), `npm install` of the 7 packages at `0.1.0-preview.2` with `svelte`, `vite`
and `@sveltejs/vite-plugin-svelte`: all 7 at that version, each with its `skills/tarol-*/SKILL.md` in `node_modules`;
a page with `createClient`, `setTarol`, `ThemeRoot`, `QueryState` and `DataTable` built (78.01 KB / 30.12 KB gzip JS,
7.34 KB / 1.95 KB CSS) and rendered its rows in Chromium with 0 page errors [verified]. It found one bug: **the installed
`tarol-codegen` bin did nothing and exited 0** (codegen.md §8, fixed in PR #28).

The owner chose to make it a job (SV-23): **`consumer`** in `release.yml`, after `publish` (`packages: read`,
`GITHUB_TOKEN`), runs `node eng/consumer.mjs <version>`, which does the same in a temporary directory: `ignore-scripts`,
the 7 packages from GitHub Packages plus Svelte, Vite and the plugin at the repository's versions; every package at the
version with its skill; the installed bin generates the sample's client from the codegen fixture; the page builds and
renders its 2 rows (stub `/api/auctions` on a local server) in the repository's Playwright Chromium. Every problem is
listed; any problem fails the job. `--from <dir>` installs `.tgz` files instead (with `overrides`, so their own
`@clorat` dependencies resolve to the other tarballs), for a rehearsal before a tag.

**Verification** [verified]:
* Against the published `0.1.0-preview.2`: `problem: tarol-codegen: the installed bin wrote no client`, exit 1: the real
  bug is the deliberate violation, and nothing else is reported.
* Against tarballs packed from PR #28 (the fix) as `0.1.0-preview.9`: `7 packages at 0.1.0-preview.9 installed, skills
  present, bin and page work`, exit 0.
* `eng/tests/consumer.test.mjs`: 3 tests (the package list; a complete install; a missing package, another version and a
  missing skill, each reported), part of `pnpm eng:test`.

The release is out when `consumer` runs; a red job means the version is broken for consumers, and the next version fixes
it (a version on the feed is never replaced). `0.1.0-preview.2` fails this check: the next release, with #28, passes it.

## `0.1.0-preview.3` (2026-11-21)

The owner asked for the next release of both repositories. Tarol-Net `main` was still its `v0.1.0-preview.2` commit
`9b68afc`, so Tarol-Net `0.1.0-preview.3` (Tag dispatched by this session at the owner's request) has the same code; it
is cut to keep the versions equal (SV-20), and the `e2e` pin `9b68afc` stays right. tarol-svelte `0.1.0-preview.3`
ships the codegen bin fix (#28), and is the first release with the `consumer` job (#32). Before the tag, the
`[Unreleased]` entries move into `[0.1.0]` as "in 0.1.0-preview.3" parts, which the release notes use; `release.mjs
check 0.1.0-preview.3`: 7 packages, 0 problems [verified].

## 0.1.0-preview.5 (2026-11-22)

Built against Tarol-Net `0.1.0-preview.5` (`380f177`, BC-23 and BC-25), which the `e2e` job now pins; there is no
tarol-svelte `0.1.0-preview.4` (SV-20: the next real release takes Tarol-Net's version). Shipped in the same pull request
as the work it releases (SV-29). `release.mjs check 0.1.0-preview.5` after `set-version`: 7 packages, 0 problems
[verified]. The environment `release` has no required reviewer, which the owner accepted (SV-30).

## 0.1.0-preview.6 (2026-11-26)

Built against Tarol-Net `0.1.0-preview.6`: its code is `main` after Tarol-Net #126 (`c9b662b`, Tatalu rounds 2 and 3, the audit
packages), which the `e2e` job now pins; Tarol-Net's ship commit changes no code. Brings TS-22 … TS-41 (the client side of rounds
2 and 3). `release.mjs check 0.1.0-preview.6` after `set-version`: 7 packages, 0 problems [verified].
