<!-- Task 2, a detail page: one view, its loading, error and stale states. -->
<script lang="ts">
  import { DetailLayout } from '@clorat/tarol-components';
  import { query } from '@clorat/tarol-svelte';
  import { requests, type AuctionId, type AuctionView } from '../artflow/api.js';

  const { id }: { id: AuctionId } = $props();
  const view = query<AuctionView>(() => requests.auctionView({ auction: id }));
</script>

<DetailLayout query={view} title={(a: AuctionView) => `Auction ${a.id}`}>
  {#snippet children(a: AuctionView)}<p>{a.bids} bids, reserve {a.reserve}</p>{/snippet}
</DetailLayout>
