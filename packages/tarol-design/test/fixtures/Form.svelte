<script lang="ts">
  import { Button, NumberField, TextField, ThemeRoot, de } from '../../src/lib/index.js';

  interface Props {
    error?: string;
    locale?: 'en' | 'de';
    theme?: 'light' | 'dark' | 'auto';
    density?: 'comfortable' | 'compact';
    loading?: boolean;
  }
  let { error, locale = 'en', theme = 'auto', density = 'comfortable', loading = false }: Props = $props();
  let title = $state('');
  let reserve = $state<number | null>(null);
</script>

<ThemeRoot {theme} {density} {locale} messages={locale === 'de' ? de : undefined}>
  <main>
    <TextField label="Title" bind:value={title} {error} required hint="3 to 80 characters" />
    <NumberField label="Reserve" bind:value={reserve} />
    <Button {loading} onclick={() => (title = 'clicked')}>Save</Button>
    <Button variant="secondary">Cancel</Button>
    <output data-testid="values">{JSON.stringify({ title, reserve })}</output>
  </main>
</ThemeRoot>
