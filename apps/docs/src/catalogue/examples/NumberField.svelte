<script lang="ts">
  import { NumberField } from '@clorat/tarol-design';
  let reserve = $state<number | null>(150);
</script>

<NumberField label="Reserve (EUR)" hint="Empty means no reserve" bind:value={reserve} />
<p>Value: {JSON.stringify(reserve)}</p>
