# Design philosophy

Every package in tarol-svelte is held to the principles below. Each one has a **measure**, plus a **check** that fails
CI when the principle is broken. A principle without a check is a wish, so a PR that adds a principle adds its check too.

Labels, as in Tarol-Net: **[verified]** = reproduced here by a command, a test or a measurement (the command is given);
**[verified by reading]** = read in named code, not run; **[unverified]** = not tried.

## P1. Fast by default

| Rule | Measure | Check in CI |
|---|---|---|
| Size budgets per package entry (SV-15) | gzip (brotli recorded too) of a production bundle that imports the entry | `size-limit` per package; a deliberate violation in the foundation PR proves the check fails |
| No runtime dependency beyond Svelte, unless measured and decided | the `dependencies` of each `package.json` | `eng/check-deps.mjs`: every runtime dependency must be on the allowlist in `docs/migration/dependencies.md` (today only `svelte` as a peer and `oauth4webapi` for `tarol-oidc`, SV-7) |
| Tree-shakeable | ESM only, `"sideEffects": false` (CSS files listed explicitly), no top-level work | `publint` and `attw`; `eng/check-treeshake.mjs` bundles `import {} from '<pkg>'` and asserts 0 bytes of output |
| Lists virtualize above 200 rows | in Chromium a keyed list of 100 rows renders in 12.6 ms, 500 in 42.6 ms and 1,000 in 74.7 ms (min of 5 runs, second run; [verified] `docs/migration/measurements/bench.cjs`) | component test: 1,000 rows render ≤ 60 DOM rows |
| Keyset paging, never offset | the client has no `offset` parameter, even though the backend accepts one (0…1000) | the type tests in `tarol-client` |
| ETag reuse | every view and list read sends `If-None-Match` when an entry is cached; a 304 reuses the entry | unit test with a fake server, plus e2e against the sample (304 count) |
| No layout shift | CLS ≤ 0.01 on every docs page and in e2e | Playwright `PerformanceObserver('layout-shift')` |
| Interaction latency | INP ≤ 100 ms (p75 of the e2e interactions) on the CI machine | Playwright e2e with the `web-vitals` attribution build injected in tests only |

## P2. Little to write

* **One typed call per backend entry.** `changes.placeBid({ auction, amount })` and `queries.auctions.list({ sort, after })`
  are generated from the backend contract (SV-4). Hand-written code never repeats a route, a header or a status code.
* **Forms map `Invalid` field paths onto their fields with no glue.** `form.field('lines[1].quantity')` receives the server's
  code and its message; the client rules come from the same generated metadata (SV-5).
* **A push subscription is one option:** `query(() => requests.auctionView({ auction: id }), { live: 'artflow.bid-placed' })`
  revalidates the view when a message about that auction arrives (the generated request names its stream, SV-24);
  `live(() => topic)` exposes the latest message.
* **Measure:** the lines of code of the sample screens in the docs app (shell, list, create form, detail), recorded in the
  components note. **Check:** the docs app is built and its e2e test runs in CI, so the examples cannot rot.

## P3. No bloat

* `tarol-client` does not import Svelte. `tarol-design` does not import `tarol-client`. `tarol-components` is the only package
  that combines them.
* Nothing global unless asked for: no global CSS reset, no `window` listeners at import, no singletons. A `TarolClient` is
  created by the app and passed through context.
* **Check:** `eng/check-deps.mjs` enforces the dependency graph in [overview.md](overview.md#packages); a test imports
  every entry in Node (no DOM) and asserts that no global is touched.

## P4. Good defaults, open ends

* The default components look right with no configuration: tokens for colour, spacing, radius, typography, motion and
  density; light and dark themes; `prefers-color-scheme` respected; comfortable or compact density.
* Every component can be themed through tokens (`--t-*` custom properties), composed (snippets for cells, empty and error
  states), and replaced piece by piece (each default component is built from public primitives, and an app can take the
  same primitives to build its own).
* **Check:** visual regression per component × theme × density (SV-12); a docs page that re-themes every component through
  tokens only.

## P5. Correct

* **The exact backend shapes.** `Id<T>` is a branded UUID string; `Option<T>` is `T | null`; a change returns a union
  `Ok | Invalid | Failure`, never an exception for a business failure. Exceptions are reserved for programming errors and
  aborts. Network failures become a `Failure` with `code: 'Network'`.
* **Idempotency keys on every change.** One key per user intent, kept across retries of the same intent, as the backend
  fingerprints the raw body (Tarol-Net `ChangeEndpoints.cs:107-148`).
* **Tenant and auth handled once**, in the client's `TokenProvider` and its cache key, never per call.
* **SPA-only, but SSR-safe by construction** (SV-3): no browser global at import time, so a later SvelteKit decision is
  not blocked.
* **Check:** the contract tests run the client against recorded backend answers; the e2e suite runs against the real
  sample (`samples/Sagas`); `tsc --noEmit` on type tests (`expectTypeOf`).

## P6. Accessible

* WCAG 2.2 AA; keyboard first (every interaction works without a pointer); visible focus; focus management in dialogs
  (return focus on close); `prefers-reduced-motion` turns transitions off; contrast of token pairs ≥ 4.5:1 (text) and ≥ 3:1
  (UI parts).
* **Check:** axe-core in every component test and on every docs page (0 violations); keyboard tests per primitive after
  the WAI-ARIA APG pattern; `eng/check-contrast.mjs` computes the contrast of every token pair in both themes.

## P7. International

* German and English from day one; no hard-coded user-visible strings in components. Every message comes from a catalogue
  (`tarol-design/messages`), keyed by a stable id. Backend codes (`Range`, `Auction.NotSeller`) are message ids too.
* Numbers, dates and currency through `Intl` with the app's locale.
* **Check:** a lint rule (`svelte/no-raw-text`-style custom rule, `eng/eslint/no-literal-text.js`) forbids text nodes in
  component markup; a test asserts that the de and en catalogues have the same keys.

## How a PR is held to it

The PR template has one line per principle. A PR that does not touch a principle says "n/a". A PR that breaks one needs
an owner decision (SV-*), recorded in [decisions.md](../migration/decisions.md) with the measurement.
