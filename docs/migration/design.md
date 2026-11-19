# Steps 4 and 7: `@clorat/tarol-design` and `@clorat/tarol-components`

## 1. Inventory: what the first screen needs

From the sample (`samples/Sagas`): a page shell with navigation and a user menu; a list of auctions with sort and
keyset paging; a create form with field errors; a detail view; an action that can be refused (403 `Auction.NotSeller`)
or conflict (409); loading, empty and error states; notifications (toasts) for push updates.

## 2. Candidates, with measurements

Sizes on top of the Svelte baseline (15.79 KB gzip), one modal dialog with title, description and close button,
production build [verified, `measurements/README.md`]:

| Primitive layer | Licence | Bundle with dialog (gzip / brotli) | Added by the dialog |
|---|---|---|---|
| Bits UI 2.21.0 | MIT | 41.31 / 36.01 KB | **+25.5 KB** |
| Melt UI 0.86.6 (store-based builders) | MIT | 32.74 / 28.82 KB | **+16.9 KB** |
| own, on native `<dialog>` (`showModal()`, return focus, backdrop click) | ours | 18.01 / 15.94 KB | **+2.2 KB** |

Styling, the same button (two variants), field with error, dialog and table, minified [verified]:

| Approach | CSS gzip / brotli | Global effects | Consumer build step |
|---|---|---|---|
| Tailwind v4.3.5 (`@import "tailwindcss"`, classes in markup) | 3.41 / 2.95 KB | preflight resets `*, ::before, ::after, ::backdrop` globally | Tailwind must scan the library's files |
| plain CSS with `--t-*` custom properties under a root class | 0.84 / 0.70 KB | none (`:where(.t-root)` scope) | none |

Decided: SV-9 (plain CSS tokens), SV-10 (own primitives on native elements).

## 3. Design

* **Tokens** (`tarol-design/tokens.css`): colour (`--t-color-{bg,bg-subtle,fg,fg-muted,border,accent,accent-fg,danger,
  warning,success}`), space (`--t-space-1…8`, 4 px base × density), radius, typography (`--t-font-*`, `--t-text-*`), shadow,
  motion (`--t-duration-*`, 0 under `prefers-reduced-motion`), z-layers. Colours in OKLCH with a hex fallback.
* **Themes**: `light` (default), `dark` (follows `prefers-color-scheme` unless `data-theme` is set on the root), density
  `comfortable` | `compact` via `data-density`. A theme is a set of token overrides, so an app theme is one CSS file.
* **Scope**: everything lives under `.t-root` (the `ThemeRoot` component sets it); zero global selectors. The contrast of
  every text and UI token pair is checked by `eng/check-contrast.mjs` (P6).
* **Primitives** (Svelte 5, native first): `Button`, `IconButton`, `TextField`, `NumberField`, `Select` (native),
  `Checkbox`, `Field` (label, hint, error wiring with `aria-describedby` / `aria-invalid`), `Dialog` (`<dialog>`), `Popover`
  (`popover` attribute), `Toast` region (`role="status"` / `aria-live`), `Spinner`, `Skeleton` (fixed size, so no layout shift),
  `VisuallyHidden`, icons as inline SVG components (one file each, tree-shaken).
* **Messages**: `messages/en.ts`, `messages/de.ts` with the same keys; `setMessages(locale | catalogue)`; backend codes
  (`Range`, `Required`, `Auction.NotSeller`) are keys with fallbacks (`code` → generic per status).
* **Components** (`tarol-components`): `DataTable` (columns as snippets, sort by the query's `sort` enum, `more()` paging,
  virtualization above 200 rows, sticky header, keyboard row navigation), `ChangeForm` + `FormField` (binds a
  `changeForm`), `QueryState` (loading skeleton, empty, error with the violation's message, stale badge), `Toaster`
  (push and change outcomes), `AppShell` (header, nav, main landmark, skip link).

## 4. Decisions

SV-9, SV-10, SV-12 (visual regression yes), SV-13 (own catalogue), SV-15 (budgets: design CSS ≤ 6 KB, each primitive
≤ 2 KB, `DataTable` ≤ 6 KB); answered.

## 5. What the PR must do (step 4)

Tokens, themes, density, `ThemeRoot`, `Button`, `Field`/`TextField`/`NumberField`, `Dialog`, `Toast` region, `Spinner`,
`Skeleton`; components `DataTable` (without virtualization if it pushes the budget: then a separate entry), `QueryState`,
`ChangeForm`, `AppShell`. Component tests with axe (0 violations), keyboard tests (dialog: focus in, Esc, focus return;
table: arrow keys), reduced-motion test, contrast check, visual regression baselines (light/dark × comfortable/compact)
generated in the CI container. The docs app gets one page per component.

## 6. Skill evaluation checklist

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "Make the accent colour green" | override `--t-color-accent` in a theme file | editing component CSS; `!important` |
| "Add a confirm dialog" | `<Dialog bind:open>` | a div with `role="dialog"` and a hand-written focus trap |
| "Show auctions in a table" | `<DataTable query={auctions}>` with column snippets | `{#each}` over thousands of rows without virtualization |
| "German labels" | `setMessages('de')` | literal strings in markup |

## 7. Built in step 4: public API, choices and verification

**Public API (new)**, reports `packages/tarol-design/api/tarol-design.api.md` and
`packages/tarol-components/api/tarol-components.api.md` (generated):

* `@clorat/tarol-design`: `tokens.css`; `ThemeRoot`, `Button`, `Field`, `TextField`, `NumberField`, `Dialog`, `Toaster`,
  `Spinner`, `Skeleton`, `VisuallyHidden`; `en`, `de`, `translator`, `getMessages`, `setMessages`, `Catalogue`,
  `Translate`, `MessageParams`; `createToasts`, `getToasts`, `setToasts`, `Toast`, `Toasts`.
* `@clorat/tarol-components`: `DataTable` (+ `DataTableProps`, `Column`), `QueryState`, `ChangeForm`, `FormField`,
  `AppShell`, `setAt`.

**Changes against §3 and §5, with reasons**

* **Catalogues are passed, not selected by locale**: `<ThemeRoot locale="de" messages={de}>`. A `locale` switch inside
  ThemeRoot bundled both catalogues into every app: ThemeRoot measured 3.11 KB gzip, Dialog 2.25 KB and TextField 2.23 KB
  (over the 2 KB primitive budget) because the English fallback pulled the full catalogue. Now each catalogue is its own
  module, primitives fall back to the 14 `ui.*` English texts only (`ui-en.ts`), and only the catalogues an app passes
  are bundled: Dialog 1.75 KB, TextField 1.73 KB, ThemeRoot (with Toaster and `en`) 2.57 KB [verified].
* Colours are sRGB hex instead of OKLCH, so the contrast check computes WCAG ratios exactly; tokens come from one source
  (`packages/tarol-design/scripts/tokens.mjs`) for both the CSS and the check.
* ThemeRoot has a budget of 3 KB (it bundles Toaster, the toast queue and the English catalogue), above the 2 KB per
  primitive of SV-15; "everything" in tarol-design is 6.23 KB (8 KB budget).
* Messages without known bounds use a `<code>.any` text (`Range.any`), never a raw `{min}` placeholder.
* **Moved to later steps**: visual regression baselines (SV-12) move to the docs app (step 9), where every component page
  exists in both themes and densities and the screenshots are generated in the CI container; keyboard row navigation in
  `DataTable` (arrow keys) moves to step 7 with the grid pattern; optimistic changes stay with step 7's detail layout.
* Svelte packages are built with `svelte-package` (`@sveltejs/package` 3.0.3); `eng/doc-svelte-dts.mjs` copies each
  component's `@component` doc onto the `type X = …` alias that svelte2tsx emits, because API Extractor's
  `ae-undocumented` (an error here) treats the alias as undocumented.
* Sizes are measured on the compiled components with their CSS injected (`eng/bundle-svelte.mjs`, `css: 'injected'`).
* Optional props accept `undefined` explicitly, so apps with `exactOptionalPropertyTypes` can forward optional values.

**New checks**

* `eng/check-contrast.mjs`: 30 token pairs (15 per theme), text ≥ 4.5:1, UI ≥ 3:1; 0 below the minimum, lowest margin
  ×1.29 (light) and ×1.59 (dark) [verified]; proven by a test with a 2.85:1 pair.
* `eng/check-text.mjs` (P7): parses every shipped `.svelte` with the Svelte compiler; text nodes and static
  `aria-label`/`title`/`placeholder`/`alt` with a letter fail; 15 components, 0 literal texts [verified]; proven by a test.

**Verification**

* Tests in Chromium: tarol-design **14** (fields and buttons 5, themes 2, dialog 3, toasts 1, messages 3), tarol-components
  **7** (DataTable 4 incl. virtualization of 1,000 rows to ≤ 60 rendered and scrolling to row 500, forms 3); axe-core 4.14.1
  (WCAG 2.0–2.2 A/AA tags) with 0 violations in every rendered state: fields with errors, both themes, compact density,
  open dialog, toasts, table, form with errors in English and German [verified]. 3 runs in a row green.
* Sizes (gzip, compiled with CSS, without Svelte and other @clorat packages): tokens.css 0.93 KB (≤ 6), Dialog 1.75,
  Button 1.26, TextField 1.73 (≤ 2 each), ThemeRoot 2.57 (≤ 3), all of tarol-design 6.23 (≤ 8); DataTable 2.26 (≤ 6),
  ChangeForm + FormField 1.35, QueryState 1.37, AppShell 1.1 (≤ 2 each) [verified].
* svelte-check 0 errors / 0 warnings, ESLint 0, publint clean, API reports generated with 0 undocumented members.

## 8. Step 7 (more components)

Combobox (APG pattern, popover), menu button, tabs, date field (native `input type=date` first), search box (needs BC-8:
escaped snippets), detail layout. Each with the same tests as step 4.
