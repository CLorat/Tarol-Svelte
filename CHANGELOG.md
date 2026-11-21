# Changelog

All notable changes to the tarol-svelte packages. The format follows Keep a Changelog; versions follow SemVer.

## [Unreleased]

### Fixed

* `@clorat/tarol-codegen`: the installed `tarol-codegen` command did nothing and exited 0 (also with `--check`), because
  the entry check compared file names and the bin is a link named `tarol-codegen`; it compares the resolved paths now.

## [0.1.0]

The first release of tarol-svelte: 7 packages under `@clorat/` on GitHub Packages. Its first pre-release is
`0.1.0-preview.2` (2026-11-21), the version of Tarol-Net it is built and tested against (SV-20); there is no
`0.1.0-preview.1` here, so everything below shipped in it. Later pre-releases add their own "in 0.1.0-preview.N" parts.

### Added in 0.1.0-preview.2

* `tag.yml` (Actions → Tag): creates the release tag `v<version>` on `main` after `eng/release.mjs check` and starts
  `release.yml` on it, for releases without local git. `release.yml` now also publishes when dispatched on a `v*` tag.
* `@clorat/tarol-admin` 0.1.0 (step 10, BC-10): `AdminApp` (dead letters: re-drive, discard, re-drive all; projection
  versions: drop a superseded one; a data subject: export, erase, an incomplete erasure repeated), `adminEn`, `adminDe`,
  `adminErrors`. `@clorat/tarol-client`: `Problem.extensions`. `@clorat/tarol-codegen`: only the used client types are
  imported. The docs app: `#/admin` replaces the data-subject example screen.
* `@clorat/tarol-svelte` (BC-5, BC-11): `Form.detail(path)`, `Form.requestId`, `Query`/`List.requestId`.
  `@clorat/tarol-components`: `FormField` shows the bounds of the server's detail; `ChangeForm` and `QueryState` show the
  error's reference. `@clorat/tarol-design`: `ui.reference`.
* `@clorat/tarol-codegen` (BC-3, BC-4): `x-tarol-kind` required, admin and `me` operations, `x-tarol-errors` as
  `<Op>Code` unions and `errors`, `x-tarol-id` on path parameters, `x-tarol-email` checked, `Required` kept next to
  `x-tarol-rules`. `@clorat/tarol-client`: `Result<T, C>` (codes), `ClientCode`. `@clorat/tarol-svelte`: **fix** `flags: "u"`.
* `@clorat/tarol-components` (BC-8): `SearchBox` shows the backend's snippet under each title with the matched words in
  `<mark>`, all as text; `highlight()`, `Highlight`, `Segment`. `@clorat/tarol-design`: `Combobox` `item` snippet
  (budget 3.1 KB).
* `@clorat/tarol-client` (BC-5, BC-11, BC-12, BC-14, BC-16): `Invalid.details` (the backend's `errorDetails`),
  `requestId` on every result; `/push` refusals are `HubRefusal` codes (`Hub.Forbidden`, `Hub.Topic`, `Auth.Tenant`,
  `Hub.Disconnected`, `Hub.Error`) found inside SignalR's text (**breaking**: `onRefused` and `publish` gave the raw text).
  Catalogue messages for `Unknown`, `Request.UnsupportedMediaType` and the hub codes.
* Release: `release.yml` publishes a tag `v*` to GitHub Packages behind the environment `release`; `eng/release.mjs`
  (version, checks, notes).
* `apps/docs`: the component catalogue (a page per component with a live example, its source, props from the types and
  the keyboard table), tokens, five guides; catalogue checks (axe, CLS) and the CI job `visual` (SV-12).
* `@clorat/tarol-components`: `FormField` checks a field that shows an error while typing (**fix**: a corrected form
  needed two clicks, because the blur removed the error line under the pointer).
* `apps/docs`: ArtFlow example screens and the end-to-end suite against `samples/Sagas` (INP, CLS, axe); CI job `e2e`.
* `@clorat/tarol-components`: `DetailLayout`, `SearchBox`; `DataTable` is a
  keyboard-navigable grid (**behaviour change**: cells are `gridcell`s).
* `@clorat/tarol-svelte`: optimistic changes: `Query.patch`/`List.patch` and `changeForm(…, { optimistic })`, rolled back
  on any failure (409 included); `FormOptions<T, I>`.
* `@clorat/tarol-design`: `Combobox` (APG list autocomplete on `popover`), `MenuButton`, `Tabs`, `DateField`; message
  `ui.noResults`.
* `@clorat/tarol-oidc` 0.1.0: `createOidc` (authorization code + PKCE on oauth4webapi, tokens in memory, refresh at 80 %
  and on a 401 with coalescing, `restore()` by `prompt=none`, logout through the end-session endpoint) and `/zitadel`
  (`zitadel`, the four scopes, roles of the project, the backend's tenant id).
* `@clorat/tarol-codegen` 0.1.0: `tarol-codegen <openapi> -o <file> [--check]`; generates types, `requests`, `rules` and
  `tarol(client)` from a Tarol backend's OpenAPI document.
* `@clorat/tarol-design` 0.1.0: tokens (light, dark, compact density, reduced motion), `ThemeRoot`, `Button`, `Field`,
  `TextField`, `NumberField`, `Dialog`, `Toaster`, `Spinner`, `Skeleton`, `VisuallyHidden`, catalogues `en` and `de`.
* `@clorat/tarol-components` 0.1.0: `DataTable` (keyset paging, backend sort, virtualization above 200 rows),
  `QueryState`, `ChangeForm`, `FormField`, `AppShell`.
* `@clorat/tarol-svelte` 0.1.0: `setTarol`, `query`, `list` (keyset), `changeForm` (server field errors by path, client
  rules, idempotent retries), `live`; revalidation on focus, own changes and push topics.
* `@clorat/tarol-client` 0.1.0: `createClient` (changes with idempotency keys and `If-Match`, reads with the ETag cache
  and `Tarol-Read-After`, `Result`/`Violation`, `Id`, `Page`, `TokenProvider`) and `/push` (`connectPush`, the SignalR
  JSON client that never stops reconnecting).
* Foundation: pnpm workspace, strict TypeScript, ESLint/Prettier, Vitest, size-limit, publint/attw, API Extractor, CI,
  CodeQL, Dependabot.

* Design: philosophy, overview with the backend interface inventory, plan, evaluation notes, owner decisions SV-1 … SV-15,
  and the backend changes BC-1 … BC-17 proposed for Tarol-Net.
