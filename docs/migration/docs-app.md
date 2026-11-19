# Step 9: docs app and component catalogue

Decided by SV-11: an own Svelte + Vite app in `apps/docs`, static, deployed to GitHub Pages later.

* A page per component: live examples (real `.svelte` files, shown with their source), props table generated from the
  component's types, token list, keyboard table, a11y notes.
* Guides: first screen in minutes (shell + list + create form against the sample), forms and validation, push, theming,
  auth with Zitadel.
* Every page is visited by the e2e suite: axe (0 violations), CLS ≤ 0.01, screenshots (SV-12).
* No Storybook or Histoire dependency.

## Built (step 9)

**What exists** in `apps/docs` (`@clorat/tarol-docs`, private), next to the ArtFlow example screens of step 8:
* **A page per component**: 21 pages (every `.svelte` export of tarol-design and tarol-components, `FormField` shares the
  `ChangeForm` example): the `@component` doc, a **live example** (a real `.svelte` file under
  `src/catalogue/examples/`) with **its source** (`?raw`), the **props table** and a **keyboard table**.
* **Props from the types**: `scripts/props.mjs` reads each component's `Props` (or `<Name>Props`) interface with the
  TypeScript compiler: name, type, optional, bindable, the default from the `$props()` destructuring, the JSDoc. It writes
  `src/catalogue/props.json` on every `build`; `check:package` fails when the committed file is stale [verified with an
  edit]. The keyboard tables are written from the implementations and their tests (`src/catalogue/pages.ts`).
* **Tokens**: the 45 light defaults read from the shipped `tokens.css` itself (every `:where(.t-root)` block), with colour
  swatches. **Guides**: a first screen in minutes, forms and validation, push, theming, auth with Zitadel.
* The catalogue runs **without a backend**: its pages get an in-memory `TarolClient` (`src/catalogue/demo.ts`: 240
  auctions with keyset pages and sort, a view, a search, changes that refuse a bid below 100 with `amount: Range`), so it
  can be served statically (GitHub Pages later; no deploy in this PR).
* Theme and density switches in the header; `?theme=dark&density=compact` selects the initial look.

**Checks** (Playwright projects in `playwright.config.ts`; `artflow` now depends on a `sample` setup project, so the
catalogue needs no backend):
* `catalogue`: every component page and every other page (guides, tokens, home) in the light and the dark theme: it
  renders, its demo reads settle, **axe 0 violations**, **CLS ≤ 0.01** and INP ≤ 100 ms (the step 8 fixture); plus the props
  table of `Combobox` against its types and the `MenuButton` example driven by the keys of its table. **58 tests**, 3 runs
  in a row green, 26.6–27.5 s [verified].
* `visual` (SV-12): one screenshot per component × theme × density (**84**), `animations: 'disabled'`. It is skipped unless
  `TAROL_VISUAL=1`; the CI job `visual` runs it in `mcr.microsoft.com/playwright:v1.63.0-noble` with
  `--update-snapshots=missing` and uploads new baselines and differences as the artifact `visual`. **No baselines are
  committed yet**: they must come from that container, and no job of this repository gets a runner (foundation.md). The
  spec was proven locally with throw-away images: unchanged 84 passed, with `--t-color-accent` changed 10 failed; the
  images were deleted [verified].

**Found by the checks and fixed**
* **CLS 0.028 / 0.014** on the `DataTable` and `DetailLayout` pages: the loading skeletons are shorter (table) or taller
  (detail) than the loaded content, so the page below moved. The examples reserve the loaded height; the components skill
  says to (a mistake row). The components themselves are unchanged (their skeletons cannot know the app's content).
* **axe `scrollable-region-focusable`** on code blocks; Svelte's a11y lint in turn refuses `tabindex` on a `<pre>`. Code
  blocks now wrap (`pre-wrap`) and never scroll, which satisfies both without a suppression.
* `import props from './props.json'` next to `$props()` made Svelte read `$props` as a store subscription of `props`
  (`e.subscribe is not a function` at start): renamed.
* A closing script tag inside a template literal in markup ends the component's script for the Svelte tooling: the
  guide's code lives in `src/guides/first-screen.ts`.
* The artflow paged-list scenario failed once in a combined run and did not repeat in 5 further runs (2 combined, 3
  alone); recorded here, not retried away.

**Size**: the docs app is 173.85 KB / 58.83 KB gzip JS and 16.06 KB / 3.22 KB CSS (every package, every example, the demo
client). It is not a package and has no budget.
