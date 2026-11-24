<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { changeForm } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { ChangeForm, FormField } from '../../src/lib/index.js';

  // Tatalu's sign-up (TS-4): consents are booleans the server checks (an unchecked one answers 400 with its path)
  const props: { client: TarolClient } = $props();
  const form = changeForm(
    (i: { name: string; consents: { terms: boolean; photos: boolean } }) => ({
      method: 'POST',
      path: '/signups',
      body: i,
    }),
    { name: 'Ada', consents: { terms: false, photos: false } },
    { client: untrack(() => props.client) },
  );
</script>

<ThemeRoot>
  <main>
    <ChangeForm {form} submitLabel="Sign up">
      <FormField {form} path="consents.terms" label="I accept the terms" type="checkbox" required />
      <FormField
        {form}
        path="consents.photos"
        label="Photos may be shared"
        type="checkbox"
        hint="You can change it later"
      />
    </ChangeForm>
    <output data-testid="values">{JSON.stringify(form.values)}</output>
  </main>
</ThemeRoot>
