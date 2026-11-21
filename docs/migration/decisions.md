# Owner decisions (SV-*)

Recorded as each answer arrived (SV-1 … SV-15 on 2026-11-19, SV-16 … on 2026-11-20). The reasoning and the measurements behind every question are in
[plan.md](plan.md) and the evaluation notes it links to.

| # | Question | Owner's answer |
|---|---|---|
| SV-1 | Licence | **AGPL-3.0-only plus a commercial licence from the owner**, as in Tarol-Net (LICENSE, NOTICE, CONTRIBUTING.md with the CLA). The owner was told that apps bundling the library ship it to browsers and then fall under the AGPL's source offer, so closed-source apps need the commercial licence. |
| SV-1a | Repository setup | The owner creates `main`; design and build PRs target `main`. |
| SV-2 | Package split | **6 packages** under `@clorat/`: `tarol-client`, `tarol-oidc`, `tarol-svelte`, `tarol-codegen`, `tarol-design`, `tarol-components`; `tarol-admin` later. |
| SV-3 | App frame | **Plain Svelte SPA only** (Svelte 5 runes, Vite). No SvelteKit adapter. Code stays free of `window` access at import, so a later SvelteKit decision is not blocked. |
| SV-4 | Typed client | **Own generator** `@clorat/tarol-codegen` from `/openapi/v1.json` plus `x-tarol-*` extensions (backend changes BC-3/BC-4). |
| SV-5 | Client validation | **Generated from the backend's rules** (BC-4 metadata, BC-5 details on the wire); same codes; the server stays authoritative; server errors only until BC-4 lands. |
| SV-6 | Data layer | **As proposed**: cache keyed by (tenant, URL), ETag revalidation, `Tarol-Read-After` after own changes, push marks queries stale, revalidate on focus/reconnect, no polling; optimistic changes opt-in per call, rolled back on 409. |
| SV-7 | Auth | **`oauth4webapi`**, tokens **in memory only**; on reload a top-level `prompt=none` redirect; behind a `TokenProvider` port. |
| SV-8 | Push client | **Own SignalR JSON-protocol client over WebSocket**, no `@microsoft/signalr`. |
| SV-9 | Styling | **Plain CSS with custom-property tokens**, scoped, nothing global. |
| SV-10 | Accessible primitives | **Own, on native elements** (`<dialog>`, `popover`, WAI-ARIA APG patterns), axe and keyboard tests per primitive; no headless library. |
| SV-11 | Catalogue and docs | **Own Svelte + Vite docs app** in the repository (static), plus a skill per package. |
| SV-12 | Testing | Vitest (unit), Vitest browser mode on Chromium (components), axe in every component test and docs page, Playwright e2e against `samples/Sagas` with INP; **visual regression: yes, Playwright screenshots** per component × theme × density, run in the Linux CI container only (recommendation was "not for now"). |
| SV-13 | Tooling and i18n | **As proposed**: pnpm workspaces, lockfile, no install scripts; TS strict; ESLint flat + eslint-plugin-svelte + typescript-eslint, warnings are errors; Prettier; size-limit; publint + attw; API Extractor reports; own message catalogue, de + en. |
| SV-14 | Release | **GitHub Packages (npm) only**, behind the environment `release`; tags `v*` by the owner only; no `@clorat/tarol-*` package exists yet; never the public npm registry. |
| SV-15 | Size budgets | **Accepted** (gzip): client core ≤ 3 KB, `/push` ≤ 2 KB; oidc ≤ 9 KB; svelte ≤ 3 KB (without Svelte); design CSS ≤ 6 KB, each primitive ≤ 2 KB; components data table ≤ 6 KB. Lists virtualize above 200 rows. A raise needs a note entry with the measurement. |
| SV-16 | Browser login in the sample (BC-18: login v2 not running, authorize ends on a 404) | **A Tarol-Net PR from this session** (login v1 for the sample, no MFA-setup prompt); the e2e runs against its branch until it is merged (2026-11-20, [backend-fixes.md](backend-fixes.md)). |
| SV-17 | BC-19 (201 `id` without `x-tarol-id`), BC-20 (export without schema), `/me` | **Record as BCs only**; the client types what the document says; no `/me` (the admin UI shows the 403 as a message). |
| SV-18 | Size budget of `@clorat/tarol-admin` | **≤ 6 KB gzip** (without Svelte and the other `@clorat` packages); gzip and brotli recorded. |
