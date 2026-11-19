<script lang="ts">
  import { DetailLayout } from '@clorat/tarol-components';
  import { MenuButton } from '@clorat/tarol-design';
  import { query } from '@clorat/tarol-svelte';
  import { firstAuction, type DemoAuction } from '../demo.js';

  const view = query<DemoAuction>(() => ({ path: `/auctions/${firstAuction}` }));
</script>

<!-- reserve the loaded height, so the page below does not move when the view arrives (CLS) -->
<div style="min-height: 15.5rem">
<DetailLayout query={view} title={(a: DemoAuction) => a.title}>
  {#snippet meta(a: DemoAuction)}{a.bids} bids · reserve {a.reserve} €{/snippet}
  {#snippet actions()}<MenuButton items={[{ id: 'settle', label: 'Settle' }]} onselect={() => undefined}>
      Actions
    </MenuButton>{/snippet}
  {#snippet children(a: DemoAuction)}<p>Highest bid: {a.highestBid} €</p>{/snippet}
  {#snippet aside(a: DemoAuction)}<p>Seller: {a.seller}</p>{/snippet}
</DetailLayout>
</div>
