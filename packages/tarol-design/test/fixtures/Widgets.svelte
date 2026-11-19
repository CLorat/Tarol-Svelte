<script lang="ts">
  import { Combobox, DateField, MenuButton, Tabs, ThemeRoot, de, en } from '../../src/lib/index.js';

  let {
    locale = 'en',
    serverSide = false,
    theme = undefined,
  }: { locale?: 'en' | 'de'; serverSide?: boolean; theme?: 'light' | 'dark' | undefined } = $props();
  const artists = [
    { value: 'monet', label: 'Claude Monet' },
    { value: 'morisot', label: 'Berthe Morisot' },
    { value: 'manet', label: 'Édouard Manet' },
    { value: 'cassatt', label: 'Mary Cassatt' },
  ];
  let artist = $state<string | null>(null);
  let queries = $state<string[]>([]);
  let found = $state(artists);
  let tab = $state('details');
  let date = $state<string | null>(null);
  let chosen = $state<string[]>([]);
</script>

<ThemeRoot {locale} messages={locale === 'de' ? de : en} {theme}>
  <main>
    <h1>Widgets</h1>
    <Combobox
      label="Artist"
      hint="Type a name"
      options={serverSide ? found : artists}
      filter={serverSide ? false : undefined}
      onquery={(q) => {
        queries = [...queries, q];
        if (serverSide) found = artists.filter((a) => a.label.startsWith(q));
      }}
      bind:value={artist}
    />
    <DateField label="Ends on" min="2026-01-01" bind:value={date} />
    <MenuButton
      items={[
        { id: 'edit', label: 'Edit' },
        { id: 'archive', label: 'Archive', disabled: true },
        { id: 'delete', label: 'Delete' },
      ]}
      onselect={(id) => (chosen = [...chosen, id])}
    >
      Actions
    </MenuButton>
    <Tabs
      label="Auction"
      tabs={[
        { id: 'details', label: 'Details' },
        { id: 'bids', label: 'Bids' },
        { id: 'history', label: 'History' },
      ]}
      bind:selected={tab}
    >
      {#snippet children(id)}<p>Panel {id}</p>{/snippet}
    </Tabs>
    <output data-testid="values">{JSON.stringify({ artist, date, tab, chosen, queries })}</output>
  </main>
</ThemeRoot>
