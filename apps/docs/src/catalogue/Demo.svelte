<script lang="ts">
  import { setTarol } from '@clorat/tarol-svelte';
  import type { Snippet } from 'svelte';
  import { demoClient } from './demo.js';

  // the catalogue runs without a backend: its pages get the in-memory client
  let { children }: { children: Snippet } = $props();
  setTarol(demoClient());
</script>

{@render children()}
