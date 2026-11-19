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
* Pins: the same action SHAs as Tarol-Net (`checkout`, `setup-node`, `upload-artifact` v4.6.2, `download-artifact`
  v5.0.0).

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
