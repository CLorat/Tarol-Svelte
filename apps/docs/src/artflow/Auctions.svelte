<script lang="ts">
  import type { Created } from '@clorat/tarol-client';
  import { ChangeForm, DataTable, FormField, QueryState, type Column } from '@clorat/tarol-components';
  import { changeForm, list } from '@clorat/tarol-svelte';
  import { router } from '../router.svelte.js';
  import { requests, rules, type AuctionRow } from './api.js';
  import { euros, short } from './format.js';

  let sort = $state<'HighestBid' | 'OpenedAt' | undefined>('OpenedAt');
  const auctions = list<AuctionRow>(() => requests.auctionSearch({ sort, limit: 5, count: true }));
  const columns: Column[] = [
    { key: 'id', header: 'Auction' },
    { key: 'reserve', header: 'Reserve', align: 'end' },
    { key: 'bids', header: 'Bids', align: 'end' },
    { key: 'highestBid', header: 'Highest bid', align: 'end', sort: { value: 'HighestBid', direction: 'descending' } },
    { key: 'openedAt', header: 'Opened', sort: { value: 'OpenedAt', direction: 'descending' } },
  ];
  const create = changeForm<{ reserve: number | null }, Created>(
    (i) => requests.createAuction({ reserve: i.reserve ?? 0 }),
    { reserve: null },
    {
      rules: rules.createAuction,
      onSuccess: (r) => {
        router.go(`#/auctions/${r.value.id}`);
      },
    },
  );
  const opened = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<h1>Auctions</h1>
<section aria-labelledby="create">
  <h2 id="create">New auction</h2>
  <ChangeForm form={create} submitLabel="Create auction">
    <FormField form={create} path="reserve" label="Reserve (EUR)" type="number" rules={rules.createAuction.reserve} />
  </ChangeForm>
</section>
<section aria-labelledby="all">
  <h2 id="all">
    All auctions {#if auctions.total !== undefined}<span data-testid="total">({auctions.total})</span>{/if}
  </h2>
  <QueryState state={auctions}>
    <DataTable list={auctions} {columns} caption="All auctions" rowKey={(r: AuctionRow) => r.id} bind:sort>
      {#snippet cell(row: AuctionRow, c: Column)}
        {#if c.key === 'id'}<a href="#/auctions/{row.id}">Auction {short(row.id)}</a>
        {:else if c.key === 'reserve'}{euros(row.reserve)}
        {:else if c.key === 'bids'}{row.bids}
        {:else if c.key === 'highestBid'}{euros(row.highestBid)}
        {:else}{opened.format(new Date(row.openedAt))}{/if}
      {/snippet}
    </DataTable>
  </QueryState>
</section>
