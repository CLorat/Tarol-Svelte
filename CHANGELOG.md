# Changelog

All notable changes to the tarol-svelte packages. The format follows Keep a Changelog; versions follow SemVer.

## [Unreleased]

* `@clorat/tarol-svelte` 0.1.0: `setTarol`, `query`, `list` (keyset), `changeForm` (server field errors by path, client
  rules, idempotent retries), `live`; revalidation on focus, own changes and push topics.
* `@clorat/tarol-client` 0.1.0: `createClient` (changes with idempotency keys and `If-Match`, reads with the ETag cache
  and `Tarol-Read-After`, `Result`/`Violation`, `Id`, `Page`, `TokenProvider`) and `/push` (`connectPush`, the SignalR
  JSON client that never stops reconnecting).
* Foundation: pnpm workspace, strict TypeScript, ESLint/Prettier, Vitest, size-limit, publint/attw, API Extractor, CI,
  CodeQL, Dependabot.

* Design: philosophy, overview with the backend interface inventory, plan, evaluation notes, owner decisions SV-1 … SV-15,
  and the backend changes BC-1 … BC-17 proposed for Tarol-Net.
