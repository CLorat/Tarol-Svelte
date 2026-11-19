<script lang="ts">
  import { Button, Dialog } from '@clorat/tarol-design';
  let open = $state(false);
</script>

<Button variant="danger" onclick={() => (open = true)}>Delete auction</Button>
<Dialog bind:open title="Delete auction">
  <p>The auction is deleted for everyone.</p>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (open = false)}>Keep</Button>
    <Button variant="danger" onclick={() => (open = false)}>Delete</Button>
  {/snippet}
</Dialog>
