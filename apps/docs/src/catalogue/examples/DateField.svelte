<script lang="ts">
  import { DateField } from '@clorat/tarol-design';
  let ends = $state<string | null>('2026-12-24');
</script>

<DateField label="Ends on" min="2026-01-01" bind:value={ends} />
<p>Value: {JSON.stringify(ends)}</p>
