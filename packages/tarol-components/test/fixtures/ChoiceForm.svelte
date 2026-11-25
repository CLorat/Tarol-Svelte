<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { changeForm } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { ChangeForm, FormField } from '../../src/lib/index.js';

  interface Setup {
    state: 'HH' | 'SH' | null;
    setting: 'Home' | 'Rooms' | null;
    start: string | null;
    windows: { from: string | null; to: string | null }[];
  }
  const props: { client: TarolClient } = $props();
  const start: Setup = {
    state: null,
    setting: null,
    start: null,
    windows: [
      { from: '08:00', to: '12:00' },
      { from: '13:00', to: '12:00' },
    ],
  };
  const form = changeForm((i: Setup) => ({ method: 'PUT', path: '/setup', body: i }), start, {
    client: untrack(() => props.client),
  });
  const states = [
    { value: 'HH', label: 'Hamburg' },
    { value: 'SH', label: 'Schleswig-Holstein' },
  ] as const;
  const settings = [
    { value: 'Home', label: 'At home' },
    { value: 'Rooms', label: 'In rented rooms' },
  ] as const;
</script>

<ThemeRoot locale="en">
  <main>
    <ChangeForm {form} submitLabel="Save">
      <FormField {form} path="state" label="State" type="select" options={states} placeholder="Choose" />
      <FormField {form} path="setting" label="Setting" type="radio" options={settings} />
      <FormField {form} path="start" label="Start" type="date" />
      {#each form.values.windows as _, i (i)}
        <FormField {form} path="windows[{i}].from" label="From {i + 1}" type="time" />
        <FormField {form} path="windows[{i}].to" label="Until {i + 1}" type="time" />
      {/each}
    </ChangeForm>
    <output data-testid="values">{JSON.stringify(form.values)}</output>
  </main>
</ThemeRoot>
