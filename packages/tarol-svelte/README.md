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
| `changeForm(change, initial, options)` | `values` (bindable), `errors` by backend field path, `formError`, `pending`, `touch()`, `submit()` |
| `live(() => topic)` | the latest push `message` on a topic and a `count` |

Queries revalidate on window focus, after every change this client commits, and on their `live` topics (and after a push
reconnect, since the hub has no replay). Reads are cheap: the client sends `If-None-Match` and reuses 304s.

Size: 2.62 KB gzip compiled, without Svelte and `@clorat/tarol-client`. Plain Svelte 5 apps (SV-3); nothing touches
`window` at import time.

Licence: AGPL-3.0-only, or a commercial licence from the copyright holder.
