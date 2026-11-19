<script lang="ts">
  import { QueryState } from '@clorat/tarol-components';
  import { query } from '@clorat/tarol-svelte';
  import type { DemoAuction } from '../demo.js';

  const missing = query<DemoAuction>(() => ({ path: '/auctions/unknown' }));
</script>

<!-- an unknown auction: the 404's code becomes the message, with a retry -->
<QueryState state={missing}>
  <p>{missing.value?.title}</p>
</QueryState>
