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

## 9. Built in step 7, part 1: widgets in tarol-design

Step 7 is split into two PRs: this one (the widgets, in `@clorat/tarol-design`) and part 2 (in `@clorat/tarol-components`
and `@clorat/tarol-svelte`: `DataTable` arrow keys, the detail layout, the search box, optimistic changes).

**Public API (new)**, report `packages/tarol-design/api/tarol-design.api.md`:
* `Combobox` (`label`, `options: { value, label }[]`, bindable `value: string | null`, `filter` (function or `false`),
  `onquery`, `onchange`, `loading`, `hint`, `error`, `required`, `placeholder`);
* `MenuButton` (`items: { id, label, disabled? }[]`, `onselect(id)`, `variant`, the button content as children);
* `Tabs` (`tabs: { id, label }[]`, bindable `selected`, `label`, `onchange`, the panel as a snippet receiving the id);
* `DateField` (bindable `value: 'YYYY-MM-DD' | null`, `min`, `max`, `hint`, `error`, `required`);
* message id `ui.noResults` (en "No matches.", de "Keine Treffer.").

**Choices made while building**

* All three popups use the native `popover` (top layer, no z-index, no portal) and CSS anchor positioning. The menu is
  `popover="auto"` with the button as `popovertarget` invoker (light dismiss; a click on the button while open closes it
  instead of reopening, which a hand-written toggle got wrong: pointerdown dismisses, then click reopens). The combobox
  list is `popover="manual"`: focus stays in the input and it is shown and hidden by the input's state.
* Combobox follows the APG "list autocomplete" pattern: `aria-activedescendant`, the list never takes focus; pointerdown on
  an option is prevented so a click keeps the focus in the input. Leaving the field resets a half-typed text to the chosen
  option's label (a typed text is never a value). The "no results" / "loading" text is a `role=status` **next to** the
  listbox: inside it, axe reports `aria-required-children` (found by the test, fixed).
* Tabs use automatic activation (selection follows focus): panels here are cheap to render (the app's own snippet).
* DateField is the native `input type=date` (localized format and picker from the browser), as §8 planned. Its value is
  the ISO date string, which is how a backend `DateOnly` is serialized; no `Date` objects (time-zone shifts).
* Anchor positioning is supported by Chromium; browsers without it show the popup at the start of the top layer
  (usable, not aligned). The flip fallback (`position-try-fallbacks`) was left out of the combobox to fit its budget.

**Budget raise (SV-15: a raise needs a note entry with the measurement).** Combobox measures **2.99 KB gzip / 2.64 KB
brotli** compiled with its CSS, including `Field` and the message lookup (TextField with Field alone is 1.74 KB); its
budget is **3 KB** like ThemeRoot, another composite, instead of 2 KB. The first build measured 3.05 KB; it was trimmed by
deriving the "typed" state, dropping one style rule, the flip fallback and a no-op key handler. "Everything" in
tarol-design rises from 8 KB to **10 KB** (measured **9.16 KB gzip / 8.04 KB brotli** with the four widgets). The other
widgets fit the 2 KB primitive budget: MenuButton 1.70 / 1.47, Tabs 1.20 / 1.03, DateField 1.79 / 1.56 (gzip / brotli)
[verified, `pnpm size` and zlib].

**Suppressions:** one, `Combobox.svelte`: `svelte-ignore a11y_click_events_have_key_events` on the option element. The
options are never focused; the input handles the keys for them (APG combobox, `aria-activedescendant`), so a key handler
on the option would be dead code (it was, as a no-op, in the first build).

**Verification**

* Tests in Chromium: tarol-design **25** (14 before + 11): combobox 4 (filter, arrows, Enter, focus stays in the input;
  wrap, Escape twice; click keeps focus and blur restores the label; server-side mode with `onquery` and the German
  no-results text), date field 1, menu button 3 (Enter opens at the first item, disabled skipped, wrap, End, Enter
  chooses and focus returns; Arrow Up opens at the last, Escape; click toggles and light dismiss), tabs 1 (one tab stop,
  arrows with wrap, Home/End, the panel labelled by its tab and reachable by Tab), themes 2 (light and dark with the list
  open). axe 0 violations in every state; 3 runs in a row green [verified].
* Deliberate violation: `tabindex={0}` on every tab fails the tabs test [verified].
* `eng/check-text.mjs`: 19 components, 0 literal texts; svelte-check 0 errors, 0 warnings; ESLint 0; API report
  regenerated with 0 undocumented members.

### Skill evaluation checklist (additions)

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "Pick an artist from a list" | `<Combobox label options bind:value>` | a custom dropdown of `div`s; reading the typed text as the value |
| "Search the server as the user types" | `filter={false}`, `onquery`, `options`, `loading` | filtering server results again |
| "Row actions: edit, delete" | `<MenuButton items onselect>` | `<select>` for actions; own key handlers |
| "Details, bids and history sections" | `<Tabs label tabs bind:selected>` with a `children(id)` snippet | rendering all panels and hiding them with CSS |
| "End date of the auction" | `<DateField bind:value min>` (ISO string) | `Date` objects and `toISOString()` |

## 10. Built in step 7, part 2: components and optimistic changes

**Public API (new or changed)**, reports `packages/tarol-components/api/tarol-components.api.md` and
`packages/tarol-svelte/api/tarol-svelte.api.md`:
* `@clorat/tarol-components`: `DetailLayout` (+ `DetailLayoutProps`: `query`, `title`, `children`, `meta`, `actions`,
  `aside`), `SearchBox` (`label`, `onselect`, `path` = `/search`, `types`, `limit` = 8, `minLength` = 2, `debounce` = 150,
  `describe`, `placeholder`) and `SearchHit`.
* `@clorat/tarol-svelte`: `Query.patch(update)` and `List.patch(update)` (return the rollback); `FormOptions` gets a second
  type parameter `I` (default `unknown`, so existing code compiles) and `optimistic: (input: I) => (() => void) | undefined`.
* **Behaviour change**: `DataTable` is now a WAI-ARIA grid (`role="grid"`): its cells are `gridcell`s, not `cell`s
  (tests that query `getByRole('cell')` must use `gridcell`); only one element of the table is in the tab order (the
  sort buttons and widgets in cells get `tabindex=-1` except in the active cell).

**Choices made while building**

* Grid navigation: arrows, Home/End (row), Ctrl+Home/End (table), Page Up/Down (10 rows). A cell with a widget focuses the
  widget, otherwise the cell itself. Keys typed into an input inside a cell are left to the input. With virtual rows the
  grid scrolls the target row into the rendered window, waits for the render, then focuses it (Page Down from row 0 to
  row 300 of 1,000 is tested). The one-tab-stop rule is applied after each render to the widgets the app's `cell`
  snippet renders, because the component does not own them.
* Optimistic changes (SV-6): the form calls `optimistic(input)` right before sending and keeps the returned rollback. A
  `Failed` result of any kind rolls back (409 `Stream.VersionConflict`, 400, 403 …), as does a thrown change (aborted);
  success keeps the patch until the own-change revalidation (`Tarol-Read-After`) replaces it with the server's value. The
  rollback restores the previous value only if no newer read replaced the patch meanwhile, then reads again.
* `DetailLayout` composes `QueryState` (loading skeletons of the heading's height, the error with retry, the stale note) and
  renders the page's `h1`.
* `SearchBox` (BC-8): the backend's snippets are HTML built by the index (`ts_headline`, OpenSearch and Typesense
  highlights with `<b>`) [verified by reading `Tarol.Search.*` at `73b35ff`], so the box **does not request them**
  (`snippets` is not sent) and shows each hit's `title` as text. A test renders a title containing `<img onerror>` and
  asserts it stays text. Highlighted snippets follow BC-8 (plain text with marker offsets); `SearchHit` has no `snippet`
  member until then. Requests are debounced and the previous one is aborted on the next keystroke; a 503
  `Search.Building` shows its message as the field's error.
* Budgets: `DetailLayout` measures **2.13 KB gzip / 1.81 KB brotli** because it bundles `QueryState` (1.37 KB alone); its
  entry is labelled "DetailLayout (with QueryState)" with **2.5 KB**. The 2 KB per component was step 4's choice (SV-15's
  2 KB is per primitive). `SearchBox` 0.87 / 0.77 (its `Combobox` counts in tarol-design), `DataTable` with the grid
  **3.10 / 2.69** (was 2.26; budget 6), tarol-svelte **2.71 KB gzip / 2.38 KB brotli** (was 2.62; budget 3) [verified].

**Suppressions:** none.

**Verification**

* Tests: tarol-svelte **32** (25 + 7 optimistic: shown before the answer and kept on success, rolled back on 409 with a
  new read, on 400, on a throw; a newer read wins over the rollback; nothing to patch without a value; a list patch and
  its rollback); tarol-components **14** (7 + grid keys with one tab stop and axe, widget focus and virtual rows by Page
  Down, detail layout with axe, optimistic bid kept / rolled back on 409 in the real components, search box: from the
  second character, title as text with an `<img onerror>` title, choosing opens the hit, the previous request aborted).
  3 runs in a row green [verified].
* Deliberate violation: removing the rollback on failure fails 2 optimistic tests [verified].
* `eng/check-text.mjs` 21 components, 0 literal texts; svelte-check 0/0; ESLint 0; API reports regenerated.

### Skill evaluation checklist (additions)

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "Show the bid immediately" | `changeForm(…, { expectedVersion, optimistic: (i) => view.patch(…) })` | assigning `view.value`; no rollback |
| "An auction's page with actions" | `<DetailLayout query title>` + `actions` snippet with `MenuButton` | an own `h1` and loading code around it |
| "A search box in the header" | `<SearchBox label onselect>` | `{@html}` of snippets; polling; no debounce |
| "Keyboard access to the table" | nothing: `DataTable` is a grid | own `keydown` handlers; two buttons in a cell |
