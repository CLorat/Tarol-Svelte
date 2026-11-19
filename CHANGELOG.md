# Changelog

All notable changes to the tarol-svelte packages. The format follows Keep a Changelog; versions follow SemVer.

## [Unreleased]

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
