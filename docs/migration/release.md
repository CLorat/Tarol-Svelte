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
