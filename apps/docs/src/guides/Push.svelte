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

const push = connectPush({ url: 'https://api.example.com/tarol/messages', tokens });
setTarol(client, push);
// topics come from the backend's x-tarol-topics: a typo is a type error, the payload is typed
const auctions = list(() => requests.auctionSearch({}), { live: topics.bidPlaced });
const auction = query(() => requests.auctionView({ auction: id }), { live: topics.bidPlaced });`}
/>
<p>
  A browser cannot set headers on a WebSocket, so the client sends the token as <code>?access_token=</code>; the hub
  reads it there only. When the token expires the hub closes the connection, and the client reconnects with a fresh token
  from the same provider. A refused topic arrives in <code>onRefused</code> as a code such as <code>Hub.Forbidden</code>.
  A view by id reads again only for messages about its own aggregate, and skips a message whose revision it already
  has (its own change); a list reads again after the message's position (<code>Tarol-Read-After</code>), so it never
  shows the row from before the event. The ArtFlow example's list and auction page are live on
  <code>topics.bidPlaced</code>.
</p>
