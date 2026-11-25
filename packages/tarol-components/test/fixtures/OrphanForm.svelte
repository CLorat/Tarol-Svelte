<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { changeForm, type Rule } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { ChangeForm, FormField } from '../../src/lib/index.js';

  // the guardian's id is not an input (the change builder would add it); `note` has a field but no initial value
  const props: { client: TarolClient; guardian: boolean } = $props();
  const rules: Record<string, readonly Rule[]> = {
    ...(untrack(() => props.guardian) ? { guardian: [{ rule: 'Required', code: 'Required' }] } : {}),
    note: [{ rule: 'Required', code: 'Required' }],
  };
  const form = changeForm(
    (i: { name: string; guardian?: string; note?: string }) => ({ method: 'POST', path: '/guardians', body: i }),
    { name: 'Ida' },
    { client: untrack(() => props.client), rules },
  );
</script>

<ThemeRoot locale="en">
  <main>
    <ChangeForm {form} submitLabel="Add">
      <FormField {form} path="name" label="Name" />
      <FormField {form} path="note" label="Note" rules={rules['note']} />
    </ChangeForm>
  </main>
</ThemeRoot>
