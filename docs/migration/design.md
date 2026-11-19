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

## 7. Step 7 (more components)

Combobox (APG pattern, popover), menu button, tabs, date field (native `input type=date` first), search box (needs BC-8:
escaped snippets), detail layout. Each with the same tests as step 4.
