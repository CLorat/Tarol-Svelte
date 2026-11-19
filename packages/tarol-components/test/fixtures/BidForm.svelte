<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot, de } from '@clorat/tarol-design';
  import { changeForm, type Rule } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { ChangeForm, FormField } from '../../src/lib/index.js';

  const props: { client: TarolClient; locale?: 'en' | 'de' } = $props();
  const rules: Record<string, readonly Rule[]> = {
    title: [
      { rule: 'NotEmpty', code: 'Required' },
      { rule: 'Length', code: 'Length', min: 3, max: 80 },
    ],
    reserve: [{ rule: 'Range', code: 'Range', min: 1, max: 1000000 }],
  };
  const form = changeForm(
    (i: { title: string; reserve: number | null }) => ({ method: 'POST', path: '/auctions', body: i }),
    { title: '', reserve: null },
    { client: untrack(() => props.client), rules },
  );
</script>

<ThemeRoot locale={props.locale ?? 'en'} messages={props.locale === 'de' ? de : undefined}>
  <main>
    <ChangeForm {form} submitLabel="Create">
      <FormField {form} path="title" label="Title" rules={rules['title']} required />
      <FormField {form} path="reserve" label="Reserve" type="number" rules={rules['reserve']} />
    </ChangeForm>
    <output data-testid="values">{JSON.stringify(form.values)}</output>
  </main>
</ThemeRoot>
