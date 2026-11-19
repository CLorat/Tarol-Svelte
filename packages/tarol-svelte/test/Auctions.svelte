<script lang="ts">
  import { list } from '../src/index.js';

  let settled = $state(false);
  const auctions = list<{ id: string }>(() => ({ path: '/auctions', query: { settled, limit: 2 } }));
</script>

<label><input type="checkbox" bind:checked={settled} />settled</label>
<ul>
  {#each auctions.items as a (a.id)}<li>{a.id}</li>{/each}
</ul>
{#if auctions.hasMore}<button onclick={() => auctions.more()}>more</button>{/if}
