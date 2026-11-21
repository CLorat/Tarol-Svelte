<!-- Task 1, first screen: the root component with a list. -->
<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import type { PushClient } from '@clorat/tarol-client/push';
  import { AppShell, DataTable, QueryState, type Column } from '@clorat/tarol-components';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { list, setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { requests, type AuctionRow } from '../artflow/api.js';

  const props: { client: TarolClient; push: PushClient } = $props();
  setTarol(
    untrack(() => props.client),
    untrack(() => props.push),
  );
  let sort = $state<'HighestBid' | 'OpenedAt' | undefined>('HighestBid');
  const auctions = list<AuctionRow>(() => requests.auctionSearch({ sort, limit: 20 }));
  const columns: Column[] = [
    { key: 'seller', header: 'Seller' },
    { key: 'highestBid', header: 'Highest bid', align: 'end', sort: { value: 'HighestBid', direction: 'descending' } },
  ];
</script>

<ThemeRoot>
  <AppShell title="ArtFlow">
    <QueryState state={auctions}>
      <DataTable list={auctions} {columns} caption="Auctions" rowKey={(r: AuctionRow) => r.id} bind:sort>
        {#snippet cell(row: AuctionRow, c: Column)}{c.key === 'seller' ? row.seller : row.highestBid}{/snippet}
      </DataTable>
    </QueryState>
  </AppShell>
</ThemeRoot>
