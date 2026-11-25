# Changelog

All notable changes to the tarol-svelte packages. The format follows Keep a Changelog; versions follow SemVer.

## [Unreleased]

### Added

* `@clorat/tarol-oidc`: `login({ returnTo, acr, maxAge, prompt })` for a stronger or fresh sign-in, and `session.factors` (the `amr` claim) (TS-24).
* `@clorat/tarol-oidc`: `restore()` resolves `'offline'` without navigating when offline or the authorization server does not answer; opt-in `lastSession` and `oidc.lastSession()` (subject, tenant, roles; no tokens) for an app opened offline (TS-23).
* `@clorat/tarol-components`: `DataTable filter` shows only the rows a function keeps; paging stays the list's (TS-22).
* `@clorat/tarol-svelte`: `allowNull(change)` and `FormInput<I>`: a form whose required members may be `null` until the user chooses; `changeForm`'s `initial` no longer narrows the input type (`NoInfer`) (TS-21).
* `@clorat/tarol-svelte`: `changeForm(…, { draft })` keeps an unfinished input in browser storage, restores it and clears it on success or `reset()` (TS-20). New: `DraftOptions`, `DraftStorage`.
* `@clorat/tarol-design`: `defineMessages(...parts)` merges catalogue parts and throws on a key with two different texts (TS-17).
* `@clorat/tarol-design`: `Select` and `RadioGroup` (generic over the value, `null` until chosen), `TextField type="time"`. `@clorat/tarol-components`: `FormField type="select" | "radio" | "date" | "time"` with `options` and `placeholder` (TS-16).
* `@clorat/tarol-svelte`: `action(change, options)` for a change without a form: `run(input, { expectedVersion })`, `pending`, `violation`, `code`, `requestId`, `reset()` (TS-15).
* `@clorat/tarol-svelte`: `changeForm(…, { awaitRevalidation: true })` resolves a successful submit after the queries its change revalidates have read again, so "Saved" shows the saved view and a next submit starts from it (TS-14).
* `@clorat/tarol-svelte`: `Query.ready` and `List.ready`, `true` once the first value (page) arrived and never back to `false`; `loading` stays `true` on every revalidation (TS-13).
* `@clorat/tarol-codegen`: `x-tarol-constants` (backend constants as `export const <Name> = <literal> as const`) and a check of `x-tarol-types` (schemas no operation references; an unknown name is a `GenerateError`) (TS-10). New: `OpenApiDocument["x-tarol-types"]`, `OpenApiDocument["x-tarol-constants"]`, `ConstantValue`.
* `@clorat/tarol-components`: `AppShell navPosition="bottom"` (TS-1, from Tatalu): below 40rem the navigation is a one-row,
  sticky bar at the bottom of the viewport with targets of at least 44 px; above it, the side navigation. The default
  (`side`) is unchanged.
* `@clorat/tarol-design`: the catalogue key `AlreadyExists` (en, de).
* `@clorat/tarol-design`: `Checkbox` (label, hint, error with `aria-describedby`/`aria-invalid`, required marker; binds
  `checked`). `@clorat/tarol-components`: `FormField type="checkbox"` binds a boolean member by path, touched on the change,
  with the server's error of its path (TS-4).

### Fixed

* `@clorat/tarol-design`: `Tabs` with more tabs than fit scroll inside the tab list instead of widening the page; the focus ring is drawn inside the tab (TS-18).
* `@clorat/tarol-svelte`: a submit blocked by a client rule on a path no field shows (and the input has no value for) reports it in `formError` instead of returning silently (TS-12). New: `Form.register(path)`; `@clorat/tarol-components` `FormField` calls it.
* `@clorat/tarol-codegen`: nullable members are `T | null` (TS-9): `oneOf`/`anyOf` of `{type: "null"}` and one schema (a `$ref`, an enum, a record), and a type array with `"null"`, also `["null", "object"]` with members (`Option<Record>`, now a type alias `{…} | null` instead of an interface); no `Required` rule for a nullable member. `@clorat/tarol-svelte`: `changeForm` skips the rules of a nullable record's members while it is `null`.
* `@clorat/tarol-design`: `Field` (and so `TextField`, `NumberField`, `DateField`, `FormField`) puts a (no-break) space between
  the label and the required marker: "Vorname (Pflichtfeld)", not "Vorname(Pflichtfeld)" (TS-5).

### Changed

* `@clorat/tarol-components`: `AppShell navPosition="bottom"` on a phone is exactly the viewport's height and the page scrolls in the main landmark between header and bar, so nothing is ever under the bar and the document does not scroll; `main` is a tab stop in that mode (TS-19).
* `@clorat/tarol-client`: `ChangeRequest<T = undefined>` carries the result type of a change (type only); `TarolClient.change` and `@clorat/tarol-svelte` `changeForm` infer it. `@clorat/tarol-codegen` types the request of a creation as `ChangeRequest<Created<…>>`, so `changeForm(requests.createX, …)` needs no `<I, Created>` (TS-11).
* `@clorat/tarol-codegen`: an operation without `x-tarol-kind` (an app's plain endpoint) is skipped with a warning and named
  in the header comment instead of failing the generation (TS-3); `--strict` / `GenerateOptions.strict` keeps the error.
  New: `GenerateOptions.strict`, `GenerateOptions.onWarning`.

* `@clorat/tarol-design`: `translator` falls back from an unknown `X.Y` to the generic `Y` before `error.generic` (TS-2):
  `ChildDayCare.NotFound` reads as `NotFound`'s text.

## [0.1.0]

The first release of tarol-svelte: 7 packages under `@clorat/` on GitHub Packages. Its first pre-release is
`0.1.0-preview.2` (2026-11-21), the version of Tarol-Net it is built and tested against (SV-20); there is no
`0.1.0-preview.1` here. The "in 0.1.0-preview.N" parts list what each pre-release added; `0.1.0-preview.3` is built
against Tarol-Net `0.1.0-preview.3`, `0.1.0-preview.5` against Tarol-Net `0.1.0-preview.5` (there is no tarol-svelte
`0.1.0-preview.4`).

### Added in 0.1.0-preview.5

* `@clorat/tarol-codegen`: typed `topics` from the backend's `x-tarol-topics` (Tarol-Net BC-25); `live: topics.bidPlaced`
  and `live(() => topics.bidPlaced)` check the name and type the payload. `@clorat/tarol-client`: `PushedMessage.revision`
  and `.position`, `ReadOptions.readAfter`, the type `Topic`.

* `@clorat/tarol-svelte`: `changeForm(…, { from })` for edit forms over a live view: untouched fields follow the server,
  edited ones keep the input and report `conflict(path)`; the submit sends the version the edit started from (SV-26).
* `@clorat/tarol-components`: `FormField` shows a polite "changed meanwhile" notice with "Use the new value" / "Keep mine".

### Changed in 0.1.0-preview.5

* `@clorat/tarol-svelte`: live lists read again after the pushed message's position (`Tarol-Read-After`), so they never
  show the row from before the event; a live view skips a message whose revision it already has (Tarol-Net BC-23).

* `@clorat/tarol-svelte`: a live query whose request names a `subject` revalidates only for messages of that stream, and
  pushed messages are coalesced (one read in flight, one after it); `LiveTopic` and `ReadRequest.subject` are new
  (SV-24).
* `@clorat/tarol-codegen`: the request of a view by id carries `subject` (the `x-tarol-id` path parameter).

### Fixed in 0.1.0-preview.5

* `@clorat/tarol-components`: `DataTable` keeps keyboard focus on the same row (by `rowKey`) when a live update re-sorts
  or removes rows; before, focus fell to `<body>`.

### Added in 0.1.0-preview.3

* `apps/docs`: the component catalogue on GitHub Pages (`pages.yml`, SV-21): the `VITE_TAROL_PAGES=1` build without login,
  push and the screens that need the sample.

* Release: a `consumer` job after `publish` installs the published packages from GitHub Packages and uses them
  (`eng/consumer.mjs`, SV-23).

### Fixed in 0.1.0-preview.3

* `@clorat/tarol-codegen`: the installed `tarol-codegen` command did nothing and exited 0 (also with `--check`), because
  the entry check compared file names and the bin is a link named `tarol-codegen`; it compares the resolved paths now.

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
