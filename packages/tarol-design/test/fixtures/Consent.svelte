<script lang="ts">
  import { Checkbox, ThemeRoot, de } from '../../src/lib/index.js';

  const props: { error?: string | undefined; locale?: 'en' | 'de' } = $props();
  let terms = $state(false);
</script>

<ThemeRoot locale={props.locale ?? 'en'} messages={props.locale === 'de' ? de : undefined}>
  <main>
    <Checkbox label="I accept the terms" bind:checked={terms} error={props.error} required hint="Read them first" />
    <output data-testid="consent">{JSON.stringify({ terms })}</output>
  </main>
</ThemeRoot>
