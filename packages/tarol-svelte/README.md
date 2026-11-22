# @clorat/tarol-svelte

Svelte 5 runes for [Tarol](https://github.com/CLorat/Tarol-Net) backends, on top of `@clorat/tarol-client`: reactive
views and keyset lists, forms bound to backend changes with field errors on the right field, and push topics as one rune.

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { createClient } from '@clorat/tarol-client';
  import { connectPush } from '@clorat/tarol-client/push';
  import { setTarol } from '@clorat/tarol-svelte';

  const client = createClient({ baseUrl: '/api', tokens });
  setTarol(client, connectPush({ url: '/api/tarol/messages', tokens }));
</script>
```

```svelte
<!-- Auctions.svelte -->
<script lang="ts">
  import { list } from '@clorat/tarol-svelte';

  let settled = $state(false);
  const auctions = list<AuctionRow>(() => ({ path: '/auctions', query: { settled, limit: 20 } }), { live: 'artflow.bid-placed' });
</script>

{#each auctions.items as a (a.id)}<p>{a.id}: {a.highestBid}</p>{/each}
{#if auctions.hasMore}<button onclick={() => auctions.more()}>…</button>{/if}
```

```svelte
<script lang="ts">
  import { changeForm } from '@clorat/tarol-svelte';
  const form = changeForm((i: { reserve: number }) => ({ method: 'POST', path: '/auctions', body: i }), { reserve: 100 });
</script>

<input type="number" bind:value={form.values.reserve} onblur={() => form.touch('reserve')} aria-invalid={!!form.error('reserve')} />
<button disabled={form.pending} onclick={() => form.submit()}>…</button>
```

| Rune | What |
|---|---|
| `query(() => request, options)` | a view: `value`, `version`, `loading`, `violation`, `stale`, `refresh()` |
| `list(() => request, options)` | a keyset list: `items`, `total`, `hasMore`, `more()`, `refresh()`; a filter change starts at page 1 |
| `changeForm(change, initial, options)` | `values` (bindable), `errors` by backend field path, `formError`, `pending`, `touch()`, `submit()`; `optimistic: (input) => view.patch(…)` shows the result at once and rolls back on a failure (409 included) |
| `changeForm(…, { from: () => view.value })` | an edit form over a live view: untouched fields follow the server, an edited field keeps the input and reports `conflict(path)` / `resolve(path, 'mine' \| 'theirs')`; the submit sends the version the edit started from (SV-26) |
| `query(…).patch(update)`, `list(…).patch(update)` | show a value before the backend answers; return the rollback |
| `live(() => topic)` | the latest push `message` on a topic and a `count` |

Queries revalidate on window focus, after every change this client commits, and on their `live` topics (and after a push
reconnect, since the hub has no replay). Reads are cheap: the client sends `If-None-Match` and reuses 304s.

A view by id names its stream: the generated `requests.auctionView({ auction })` carries `subject: auction`, so
`query(…, { live: 'artflow.bid-placed' })` re-reads only for bids on that auction (the message's `subject`). Use
`live: { topic, subject: null }` for a topic whose messages are about another stream (e.g. a saga's). A list has no
subject and re-reads on every message. A burst of messages makes one read in flight and at most one after it.

Size: 3.17 KB gzip / 2.79 KB brotli compiled (budget 3.5 KB, SV-26), without Svelte and `@clorat/tarol-client`. Plain Svelte 5 apps (SV-3); nothing touches
`window` at import time.

Licence: AGPL-3.0-only, or a commercial licence from the copyright holder.
