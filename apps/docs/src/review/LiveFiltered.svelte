<!--
  Task 6b, live data today, the careful way: only bids on this auction re-read it. Needs live(), an $effect, the
  subject compared by hand, and the reconnect handled again (the query's own live option cannot filter).
-->
<script lang="ts">
  import { getTarol, live, query } from '@clorat/tarol-svelte';
  import { requests, type AuctionId, type AuctionView } from '../artflow/api.js';

  const { id }: { id: AuctionId } = $props();
  const view = query<AuctionView>(() => requests.auctionView({ auction: id }));
  const bids = live<{ auction: string; amount: number }>(() => 'artflow.bid-placed');
  const push = getTarol().push;
  $effect(() => {
    if (bids.message?.subject === id) void view.refresh();
  });
  $effect(() => push?.onReconnect(() => void view.refresh()));
</script>

<p>{view.value?.bids} bids</p>
