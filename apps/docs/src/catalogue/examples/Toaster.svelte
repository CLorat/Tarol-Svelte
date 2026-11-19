<script lang="ts">
  import { Button, getToasts } from '@clorat/tarol-design';
  const toasts = getToasts(); // ThemeRoot renders the Toaster
</script>

<Button onclick={() => toasts.show('Bid placed.', { kind: 'success' })}>Success</Button>
<Button variant="secondary" onclick={() => toasts.show('Something went wrong.', { kind: 'error' })}>Error</Button>
