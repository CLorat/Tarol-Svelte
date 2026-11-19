<script lang="ts">
  import { AppShell } from '@clorat/tarol-components';
  import { Button } from '@clorat/tarol-design';
</script>

<div style="border: 1px solid var(--t-color-border); height: 14rem; overflow: auto">
  <AppShell title="ArtFlow" navLabel="Example">
    {#snippet nav()}<a href="#/components/AppShell">Auctions</a>{/snippet}
    {#snippet actions()}<Button variant="secondary">Sign out</Button>{/snippet}
    <p>The page.</p>
  </AppShell>
</div>
