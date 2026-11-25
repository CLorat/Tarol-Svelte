<script lang="ts">
  import { RadioGroup } from '@clorat/tarol-design';
  const forms = [
    { value: 'written', label: 'Written', hint: 'signed on paper' },
    { value: 'digital', label: 'Digital' },
  ] as const;
  let form = $state<(typeof forms)[number]['value'] | null>(null);
</script>

<RadioGroup label="Form of consent" options={forms} required bind:value={form} />
<p>Value: {JSON.stringify(form)}</p>
