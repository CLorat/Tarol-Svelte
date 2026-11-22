<!-- Task 6a, live data today, the short way: every bid on any auction re-reads this auction (one GET per message). -->
<script lang="ts">
  import { query } from '@clorat/tarol-svelte';
  import { requests, type AuctionId, type AuctionView } from '../artflow/api.js';

  const { id }: { id: AuctionId } = $props();
  const view = query<AuctionView>(() => requests.auctionView({ auction: id }), { live: 'artflow.bid-placed' });
</script>

<p>{view.value?.bids} bids</p>
