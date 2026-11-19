<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { MenuButton, ThemeRoot } from '@clorat/tarol-design';
  import { changeForm, query, setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { ChangeForm, DetailLayout, FormField, SearchBox, type SearchHit } from '../../src/lib/index.js';

  interface Auction {
    id: string;
    title: string;
    highest: number;
  }

  const props: { client: TarolClient; aside?: boolean } = $props();
  setTarol(untrack(() => props.client));
  const view = query<Auction>(() => ({ path: '/auctions/a' }));
  const bid = changeForm(
    (i: { amount: number | null }) => ({ method: 'POST', path: '/auctions/a/bids', body: i }),
    { amount: 150 },
    {
      expectedVersion: () => view.version,
      optimistic: (input) => view.patch((a) => ({ ...a, highest: input.amount ?? a.highest })),
    },
  );
  let opened = $state<SearchHit | null>(null);
  let action = $state('');
</script>

<ThemeRoot>
  <header>
    <SearchBox label="Search" debounce={0} onselect={(h) => (opened = h)} />
  </header>
  <main>
    <DetailLayout query={view} title={(a) => a.title}>
      {#snippet meta(a)}<span data-testid="highest">{a.highest}</span>{/snippet}
      {#snippet actions()}
        <MenuButton
          items={[
            { id: 'settle', label: 'Settle' },
            { id: 'copy', label: 'Copy link' },
          ]}
          onselect={(id) => (action = id)}
        >
          More
        </MenuButton>
      {/snippet}
      {#snippet children()}
        <ChangeForm form={bid} submitLabel="Bid">
          <FormField form={bid} path="amount" label="Amount" type="number" />
        </ChangeForm>
      {/snippet}
      {#snippet aside()}<p>History</p>{/snippet}
    </DetailLayout>
    <output data-testid="opened">{opened ? `${opened.type}:${opened.aggregate}` : ''}</output>
    <output data-testid="action">{action}</output>
  </main>
</ThemeRoot>
