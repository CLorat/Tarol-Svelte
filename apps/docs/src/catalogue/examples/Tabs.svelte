<script lang="ts">
  import { Tabs } from '@clorat/tarol-design';
  let tab = $state('details');
</script>

<Tabs
  label="Auction"
  tabs={[
    { id: 'details', label: 'Details' },
    { id: 'bids', label: 'Bids' },
    { id: 'history', label: 'History' },
  ]}
  bind:selected={tab}
>
  {#snippet children(id)}<p>The {id} of the auction.</p>{/snippet}
</Tabs>
