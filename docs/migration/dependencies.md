# Dependencies

Every dependency is decided here with its version, licence (compatible with AGPL-3.0-only, SV-1), size and maintenance.
Runtime dependencies are rare and enforced by `eng/check-deps.mjs`; dev dependencies are added by the PR that needs them.

## Runtime

| Package | Used by | Version | Licence | Size (gzip) | Maintenance | Decision |
|---|---|---|---|---|---|---|
| `svelte` | peer of `tarol-svelte`, `tarol-design`, `tarol-components` | ^5.58.0 | MIT | app baseline 15.8 KB | Svelte core team, weekly releases | SV-3 |
| `oauth4webapi` | `tarol-oidc` | 3.8.8 | MIT | 6.9 KB | single maintainer (panva), certified OpenID implementation, zero dependencies | SV-7 |

## Development only (not shipped)

| Package | Version | Licence | Why |
|---|---|---|---|
| `axe-core` | 4.14.1 | MPL-2.0 | accessibility rules in every component test (P6); test-only, never bundled into a package |
| `@sveltejs/package` | 3.0.3 | MIT | builds the Svelte component packages (`svelte-package`); keeps `.svelte` sources for the app's compiler |
| `@size-limit/file` | 14.3.0 | MIT | measures the compiled bundles that `eng/bundle-svelte.mjs` writes |
| `@playwright/test` | 1.63.0 | Apache-2.0 | the e2e runner of `apps/docs` (SV-12); the same version as `playwright`, whose Chromium 1243 is installed |
| `web-vitals` | 6.2.3 | Apache-2.0 | INP and CLS in the e2e suite (P1); injected into the test page only, never a dependency of a package or the app |

The rest of the toolchain (TypeScript, ESLint, Prettier, Vitest, Playwright, size-limit, publint, attw, API Extractor,
Vite, svelte-check) is listed with versions in `docs/migration/foundation.md`; all MIT or Apache-2.0.

## Measured and rejected

| Package | Version | Licence | Size (gzip) | Why not |
|---|---|---|---|---|
| `@microsoft/signalr` | 11.0.0 | MIT | 19.9 KB | own client ≈ 1 KB (SV-8) |
| `oidc-client-ts` | 3.5.0 | Apache-2.0 | 21.9 KB | 3× `oauth4webapi`, iframe renew (SV-7) |
| `openapi-fetch` | 0.17.0 | MIT | 3.6 KB | own runtime 0.4 KB with Tarol semantics (SV-4) |
| `bits-ui` | 2.21.0 | MIT | +25.5 KB per dialog | own primitives +2.2 KB (SV-10) |
| `@melt-ui/svelte` | 0.86.6 | MIT | +16.9 KB per dialog | same (SV-10) |
| `tailwindcss` | 4.3.5 | MIT | 3.4 KB CSS (with global preflight) | plain CSS tokens 0.8 KB, nothing global (SV-9) |
