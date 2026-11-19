<script lang="ts">
  import Code from './Code.svelte';
</script>

<h1>Push</h1>
<p>
  The UI push client speaks SignalR's JSON protocol to the backend's hub and never stops reconnecting. Queries and lists
  revalidate on a topic's messages and after a reconnect (the hub has no replay).
</p>
<Code
  code={`import { connectPush } from '@clorat/tarol-client/push';

const push = connectPush({ url: '/api/tarol/messages', tokens });
setTarol(client, push);
const auctions = list(() => requests.auctionSearch({}), { live: 'artflow.bid-placed' });`}
/>
<p>
  In a browser the hub needs the token in the query string (backend change BC-2) and the sample maps no hub yet (BC-9);
  until then push runs against the contract tests' fake hub only.
</p>
