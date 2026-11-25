<!-- The same component with its types from sent.ts. -->
<script lang="ts">
  import type { Sent } from './sent.js';

  interface Props {
    onSent: (sent: Sent) => void;
  }
  let { onSent }: Props = $props();
</script>

<button
  type="button"
  onclick={() => {
    onSent({ id: 'a' });
  }}
>
  x
</button>
