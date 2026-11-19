// The code of the first-screen guide, kept in a module: a closing script tag inside a template literal in Svelte markup
// ends the component's script for the Svelte tooling.

export const install = `pnpm add @clorat/tarol-client @clorat/tarol-svelte @clorat/tarol-design @clorat/tarol-components
pnpm add -D @clorat/tarol-codegen
curl -s http://localhost:5080/openapi/v1.json > openapi.json
pnpm tarol-codegen openapi.json -o src/api.ts`;

export const main = `// main.ts
import '@clorat/tarol-design/tokens.css';
import { createClient } from '@clorat/tarol-client';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.body, props: { client: createClient({ baseUrl: '/api' }) } });`;

export const app = `<!-- App.svelte -->
<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { AppShell, DataTable, QueryState, type Column } from '@clorat/tarol-components';
  import { list, setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { requests, type AuctionRow } from './api.js';

  const props: { client: TarolClient } = $props();
  setTarol(untrack(() => props.client));
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
</ThemeRoot>`;

export const form = `const create = changeForm(requests.createAuction, { reserve: 100 }, { rules: rules.createAuction });

<ChangeForm form={create} submitLabel="Create">
  <FormField form={create} path="reserve" label="Reserve" type="number" rules={rules.createAuction.reserve} />
</ChangeForm>`;
