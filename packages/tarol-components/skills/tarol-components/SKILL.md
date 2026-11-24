---
name: tarol-components
description: >-
  Use when building a Tarol app's screens from default components: a table of a backend list with sorting and "load
  more", loading/empty/error states, a create or edit form bound to a backend change, or the page shell. Covers
  DataTable, Column, QueryState, ChangeForm, FormField and AppShell from @clorat/tarol-components. Do not render large
  lists with a plain {#each}, write your own loading/error branches, or map server field errors by hand.
---

# tarol-components

## Rules

1. The components need `setTarol(...)` (from `@clorat/tarol-svelte`) and a `ThemeRoot` (from `@clorat/tarol-design`)
   above them, plus `import '@clorat/tarol-design/tokens.css'` once.
2. `DataTable` takes a `list(...)` result, `columns`, a `cell` snippet, `rowKey` and a `caption` (accessible name).
   Sorting: a column's `sort: { value, direction }` names the backend's `sort` enum member and its fixed direction;
   `bind:sort` to a `$state` that the list's request reads. Paging is "load more" (keyset); above 200 rows only the
   visible rows are rendered.
3. Wrap reads in `QueryState state={…}`: it shows skeletons for the first read, the empty text, the violation's message
   with a retry and its reference (the request id a user can quote), and a stale note while the list catches up with
   your own write.
4. Forms: `const form = changeForm(...)`, then `<ChangeForm {form} submitLabel>` with `<FormField {form} path label
   rules>` per field. `path` is the backend's field path (`reserve`, `lines[1].quantity`); pass the field's `rules` so
   messages show the bounds; without them the bounds come from the server's 400 (`errorDetails`, `1..1000000`). Coded
   refusals (403, 409) appear above the submit button as an alert with their reference.
   With `changeForm(…, { from: () => view.value })`, a FormField whose value changes on the server while the user edits
   it shows a polite notice (`role="status"`) with "Use the new value" / "Keep mine"; input and focus stay.
5. `AppShell title nav actions` gives the skip link and the landmarks; put pages in its children. Below 40rem the nav
   stacks above the page; `navPosition="bottom"` makes it a one-row bar at the bottom (thumb reach): give it a `<ul>` of
   a few links (every target ≥ 44 px). Do not add your own fixed bottom nav next to `AppShell`.
5a. One aggregate's page: `<DetailLayout query={view} title={(a) => a.title}>` with snippets `children(a)`, `meta(a)`,
   `actions(a)`, `aside(a)`; it renders the `h1` and the loading/error states. Do not wrap it in `QueryState` again.
5b. Global search: `<SearchBox label onselect={(hit) => open(hit.type, hit.aggregate)} />`; `types`, `limit`,
   `minLength` (2), `debounce` (150 ms), `snippets` (default `true`). Hits are `SearchHit` (`type`, `id`, `aggregate`,
   `title`, `score`, `snippet?`, `highlights?`); the snippet is plain text with UTF-16 ranges: render your own with
   `highlight(snippet, highlights)` → `{ text, mark }[]` as text nodes and `<mark>`.
5c. `DataTable` is a grid: keyboard navigation is built in; put at most one widget (a link or a button) in a cell. It
   remembers the active row by `rowKey`, so a live update that re-sorts or removes rows keeps keyboard focus on the same
   row (or the same place): `rowKey` must be the row's id, never its index.
6. All visible text comes from props (your labels) or the message catalogue; never literal text inside the components.

## Example

```svelte
<script lang="ts">
  import { ChangeForm, FormField } from '@clorat/tarol-components';
  import { changeForm, type Rule } from '@clorat/tarol-svelte';

  const rules: Record<string, readonly Rule[]> = { reserve: [{ rule: 'Range', code: 'Range', min: 1, max: 1000000 }] };
  const form = changeForm(
    (i: { reserve: number | null }) => ({ method: 'POST', path: '/auctions', body: i }),
    { reserve: null },
    { rules, onSuccess: (r) => goto(`/auctions/${(r.value as { id: string }).id}`) },
  );
</script>

<ChangeForm {form} submitLabel="Create auction">
  <FormField {form} path="reserve" label="Reserve" type="number" rules={rules['reserve']} required />
</ChangeForm>
```

## Common mistakes

| Mistake | What happens |
|---|---|
| `{#each auctions.items}` for thousands of rows | every row in the DOM; `DataTable` virtualizes above 200 |
| `sort` held but not read by the list's request | the header changes, the data does not |
| a hand-wired `<input type="checkbox">` for a consent | no server error on it, no `aria-invalid`: use `FormField type="checkbox"` |
| `FormField path="Reserve"` (C# casing) | no error shown: server paths are camelCase (`reserve`) |
| no `rules` on a FormField | the message has no bounds ("The value is out of range.") |
| `getByRole('cell')` in tests of a DataTable | the cells are `gridcell`s (the table is a grid) |
| ESLint `no-unsafe-*` on `row` in a `cell` snippet | typescript-eslint cannot infer a generic component's snippet types: write `{#snippet cell(row: AuctionRow, c: Column)}` and `rowKey={(r: AuctionRow) => r.id}` (svelte-check infers them) |
| content below a `QueryState` or `DetailLayout` jumps when the data arrives (CLS) | the skeletons are not the loaded height: pass `rows` close to the page size, or reserve the height (`min-height`) of the area |
| two widgets in one DataTable cell | only the first gets the focus from the arrow keys; split the cell |
| rendering a search snippet with `{@html}` | never: the snippet is plain text; `<b>` in it is the document's text. Use `highlight()` and render text nodes |

## Notes

Built only from public primitives of `@clorat/tarol-design`; replace any component by composing the same primitives.
