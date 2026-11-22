<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { changeForm, setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { ChangeForm, FormField } from '../../src/lib/index.js';

  type V = { title: string };
  const props: { client: TarolClient; server: { v: V; version: number } } = $props();
  setTarol(untrack(() => props.client));
  const form = changeForm<V>(
    (i) => ({ method: 'PUT', path: '/a', body: i }),
    { title: '' },
    {
      from: () => props.server.v,
      expectedVersion: () => props.server.version,
    },
  );
</script>

<ThemeRoot>
  <ChangeForm {form} submitLabel="Save"><FormField {form} path="title" label="Title" /></ChangeForm>
  <p>Below the form</p>
</ThemeRoot>
