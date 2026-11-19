<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { untrack } from 'svelte';
  import { setTarol } from '../src/index.js';
  import Auctions from './Auctions.svelte';

  const props: { client: TarolClient } = $props();
  // the client is fixed for the component's lifetime: read it once, untracked
  setTarol(untrack(() => props.client));
</script>

<Auctions />
