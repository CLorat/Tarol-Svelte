<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { AppShell, SearchBox } from '@clorat/tarol-components';
  import { setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import Auction from './artflow/Auction.svelte';
  import Auctions from './artflow/Auctions.svelte';
  import Subject from './artflow/Subject.svelte';
  import { router } from './router.svelte.js';

  const props: { client: TarolClient } = $props();
  setTarol(untrack(() => props.client));
  const parts = $derived(router.route.parts);
</script>

<ThemeRoot>
  <AppShell title="ArtFlow" navLabel="Main">
    {#snippet nav()}<a href="#/auctions">Auctions</a>{/snippet}
    {#snippet actions()}
      <SearchBox
        label="Search"
        onselect={(hit) => {
          router.go(`#/auctions/${hit.aggregate}`);
        }}
      />
    {/snippet}
    {#if parts[0] === 'auctions' && parts[1]}
      {#key parts[1]}<Auction id={parts[1]} />{/key}
    {:else if parts[0] === 'subjects' && parts[1]}
      <Subject id={parts[1]} tenant={router.route.query.get('tenant') ?? '00000000-0000-0000-0000-000000000000'} />
    {:else}
      <Auctions />
    {/if}
  </AppShell>
</ThemeRoot>
