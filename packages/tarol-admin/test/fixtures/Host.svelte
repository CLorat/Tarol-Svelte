<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { ThemeRoot, de } from '@clorat/tarol-design';
  import { setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import { AdminApp, adminDe } from '../../src/lib/index.js';

  const props: { client: TarolClient; section?: string; prefix?: string; locale?: 'en' | 'de' } = $props();
  setTarol(untrack(() => props.client));
  const german = untrack(() => props.locale === 'de');
</script>

<ThemeRoot locale={german ? 'de' : 'en'} messages={german ? de : undefined}>
  <main>
    <AdminApp
      section={untrack(() => props.section)}
      prefix={untrack(() => props.prefix)}
      messages={german ? adminDe : undefined}
    />
  </main>
</ThemeRoot>
