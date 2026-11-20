<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { query, setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { QueryState } from '../../src/lib/index.js';

  const props: { client: TarolClient } = $props();
  setTarol(untrack(() => props.client));
  const view = query<{ title: string }>(() => ({ path: '/auctions/a' }));
</script>

<ThemeRoot>
  <QueryState state={view}><p>{view.value?.title}</p></QueryState>
</ThemeRoot>
