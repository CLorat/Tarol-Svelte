<script lang="ts">
  import { DataTable, QueryState, type Column } from '@clorat/tarol-components';
  import { list } from '@clorat/tarol-svelte';
  import type { DemoAuction } from '../demo.js';

  let sort = $state<string | undefined>('HighestBid');
  const auctions = list<DemoAuction>(() => ({ path: '/auctions', query: { sort, limit: 10 } }));
  const columns: Column[] = [
    { key: 'title', header: 'Title', sort: { value: 'Title', direction: 'ascending' } },
    { key: 'bids', header: 'Bids', align: 'end' },
    { key: 'highestBid', header: 'Highest bid', align: 'end', sort: { value: 'HighestBid', direction: 'descending' } },
  ];
</script>

<!-- reserve the loaded height: the skeletons are shorter than 10 rows, and the page below would move (CLS) -->
<div style="min-height: 31rem">
<QueryState state={auctions} rows={10}>
  <DataTable list={auctions} {columns} caption="Auctions" rowKey={(r: DemoAuction) => r.id} bind:sort>
    {#snippet cell(row: DemoAuction, c: Column)}
      {c.key === 'title' ? row.title : c.key === 'bids' ? row.bids : `${String(row.highestBid)} €`}
    {/snippet}
  </DataTable>
</QueryState>
</div>
