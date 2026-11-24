# @clorat/tarol-components

Default Svelte 5 components bound to Tarol data, built from `@clorat/tarol-design` primitives and the runes of
`@clorat/tarol-svelte`: the first screen of a Tarol app in a few lines, and every piece replaceable.

```svelte
<script lang="ts">
  import { AppShell, DataTable, QueryState, type Column } from '@clorat/tarol-components';
  import { list } from '@clorat/tarol-svelte';

  let sort = $state('HighestBid');
  const auctions = list<AuctionRow>(() => ({ path: '/auctions', query: { sort, limit: 50 } }), { live: 'artflow.bid-placed' });
  const columns: Column[] = [
    { key: 'title', header: 'Title' },
    { key: 'highestBid', header: 'Highest bid', align: 'end', sort: { value: 'HighestBid', direction: 'descending' } },
  ];
</script>

<AppShell title="ArtFlow">
  <QueryState state={auctions}>
    <DataTable list={auctions} {columns} caption="Auctions" rowKey={(a) => a.id} bind:sort>
      {#snippet cell(a, c)}{c.key === 'title' ? a.title : a.highestBid}{/snippet}
    </DataTable>
  </QueryState>
</AppShell>
```

| Component | What |
|---|---|
| `DataTable` | a WAI-ARIA data grid: one tab stop, arrow keys, Home/End, Ctrl+Home/End, Page Up/Down; keyset paging ("load more"), headers that switch the backend `sort` (`aria-sort`), virtual scrolling above 200 rows |
| `DetailLayout` | the page of one aggregate over `query(...)`: `h1` from the value, `meta`, `actions` (e.g. a `MenuButton`), `aside`, with `QueryState`'s loading, error and stale states |
| `SearchBox` | the global search over `MapTarolSearch` (`GET /search`): a server-side `Combobox`, debounced and aborting; the title and the snippet with its matches in `<mark>`, all as text (`highlight()` for your own rendering); `onselect(hit)` |
| `QueryState` | loading skeletons (fixed height), empty text, error with the code's message and retry, stale note |
| `ChangeForm` + `FormField` | a form over `changeForm(...)`: fields bound by backend path (`type="checkbox"` for a boolean such as a consent), errors as messages with the rule's bounds, refusals announced |
| `AppShell` | skip link, header, named navigation (side, or `navPosition="bottom"`: a bottom bar below 40rem), main landmark |

Size (gzip, compiled, without Svelte and the other @clorat packages): DataTable 2.26 KB, ChangeForm + FormField 1.35 KB,
QueryState 1.37 KB, AppShell 1.1 KB.

Licence: AGPL-3.0-only, or a commercial licence from the copyright holder.
