<script lang="ts">
  import { Button, ThemeRoot } from '../../src/lib/index.js';

  interface Props {
    motion?: 'auto' | 'reduce';
  }
  let { motion = 'auto' }: Props = $props();
  let view = $state<'month' | 'week'>('month');
</script>

<!-- Tatalu FB-F06.1-3: view buttons whose variant follows the chosen view -->
<ThemeRoot theme="light" {motion}>
  <main>
    <Button variant={view === 'month' ? 'primary' : 'secondary'} onclick={() => (view = 'month')}>Month</Button>
    <Button variant={view === 'week' ? 'primary' : 'secondary'} onclick={() => (view = 'week')}>Week</Button>
  </main>
</ThemeRoot>
