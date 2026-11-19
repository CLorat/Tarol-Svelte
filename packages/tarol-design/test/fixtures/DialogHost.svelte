<script lang="ts">
  import { Button, Dialog, ThemeRoot } from '../../src/lib/index.js';

  let { dismissible = true }: { dismissible?: boolean } = $props();
  let open = $state(false);
  let closedCount = $state(0);
</script>

<ThemeRoot>
  <main>
    <Button onclick={() => (open = true)}>Open</Button>
    <output data-testid="closed">{closedCount}</output>
    <Dialog bind:open title="Delete auction" {dismissible} onclose={() => closedCount++}>
      <p>The auction is deleted for everyone.</p>
      {#snippet footer()}
        <Button variant="secondary" onclick={() => (open = false)}>Keep</Button>
        <Button variant="danger">Delete</Button>
      {/snippet}
    </Dialog>
  </main>
</ThemeRoot>
