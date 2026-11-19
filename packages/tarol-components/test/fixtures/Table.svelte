<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { list, setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { AppShell, DataTable, QueryState, type Column } from '../../src/lib/index.js';
  import type { Row } from '../fake.js';

  const props: { client: TarolClient; limit?: number } = $props();
  setTarol(untrack(() => props.client));
  let sort = $state<string | undefined>('HighestBid');
  const auctions = list<Row>(() => ({ path: '/auctions', query: { sort, limit: untrack(() => props.limit ?? 2) } }));
  const columns: Column[] = [
    { key: 'title', header: 'Title', sort: { value: 'Title', direction: 'ascending' } },
    { key: 'bids', header: 'Bids', align: 'end', sort: { value: 'HighestBid', direction: 'descending' } },
  ];
</script>

<ThemeRoot>
  <AppShell title="ArtFlow" navLabel="Main">
    {#snippet nav()}<a href="#auctions">Auctions</a>{/snippet}
    <QueryState state={auctions}>
      <DataTable list={auctions} {columns} caption="Auctions" rowKey={(r) => r.id} bind:sort>
        {#snippet cell(row, c)}{c.key === 'title' ? row.title : row.bids}{/snippet}
      </DataTable>
    </QueryState>
    <output data-testid="sort">{sort}</output>
  </AppShell>
</ThemeRoot>
