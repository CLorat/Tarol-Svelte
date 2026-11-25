<script lang="ts">
  import { RadioGroup, Select, ThemeRoot } from '../../src/lib/index.js';

  const props: { error?: string | undefined } = $props();
  let region = $state<string | null>(null);
  let setting = $state<string | null>('Home');
  const states = [
    { value: 'HH', label: 'Hamburg' },
    { value: 'SH', label: 'Schleswig-Holstein' },
  ];
  const settings = [
    { value: 'Home', label: 'At home', hint: 'In your own flat' },
    { value: 'Rooms', label: 'In rented rooms' },
  ];
</script>

<ThemeRoot locale="en">
  <main>
    <Select
      label="State"
      options={states}
      placeholder="Choose a state"
      bind:value={region}
      error={props.error}
      required
    />
    <RadioGroup
      label="Setting"
      options={settings}
      bind:value={setting}
      error={props.error}
      hint="Where you care"
      required
    />
    <output data-testid="values">{JSON.stringify({ state: region, setting })}</output>
  </main>
</ThemeRoot>
