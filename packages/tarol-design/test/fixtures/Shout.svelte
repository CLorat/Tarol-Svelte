<script lang="ts">
  import { Button, getToasts } from '../../src/lib/index.js';
  const toasts = getToasts();
</script>

<Button onclick={() => toasts.show('Bid placed', { kind: 'success', timeout: 1000 })}>Info</Button>
<Button onclick={() => toasts.show('Payment failed', { kind: 'error' })}>Error</Button>
