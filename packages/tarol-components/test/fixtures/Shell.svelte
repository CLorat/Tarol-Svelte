<script lang="ts">
  import { ThemeRoot } from '@clorat/tarol-design';
  import { AppShell } from '../../src/lib/index.js';

  const props: { navPosition?: 'side' | 'bottom' } = $props();
  const items = ['Today', 'Children', 'Attendance', 'Messages', 'More'];
</script>

<ThemeRoot>
  <AppShell title="Tatalu" navLabel="Main" navPosition={props.navPosition}>
    {#snippet nav()}
      <ul>
        {#each items as item, i (item)}<li><a href="#{item}" aria-current={i === 0 ? 'page' : undefined}>{item}</a></li>{/each}
      </ul>
    {/snippet}
    <h1>Today</h1>
    {#each { length: 40 } as _, i (i)}<p>Line {i}: a long word Kindertagespflegeperson stays inside the page.</p>{/each}
    <p data-testid="last">The last line</p>
  </AppShell>
</ThemeRoot>
