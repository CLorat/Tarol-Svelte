<script lang="ts">
  import { Select } from '@clorat/tarol-design';
  const states = [
    { value: 'BY', label: 'Bavaria' },
    { value: 'BE', label: 'Berlin' },
    { value: 'HH', label: 'Hamburg' },
  ] as const;
  let state = $state<(typeof states)[number]['value'] | null>(null);
</script>

<Select label="Federal state" options={states} placeholder="Choose…" required bind:value={state} />
<p>Value: {JSON.stringify(state)}</p>
