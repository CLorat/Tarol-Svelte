<script lang="ts">
  import type { TarolClient } from '@clorat/tarol-client';
  import { AppShell, SearchBox } from '@clorat/tarol-components';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import Auction from './artflow/Auction.svelte';
  import Auctions from './artflow/Auctions.svelte';
  import Subject from './artflow/Subject.svelte';
  import Demo from './catalogue/Demo.svelte';
  import Page from './catalogue/Page.svelte';
  import { pages } from './catalogue/pages.js';
  import Tokens from './catalogue/Tokens.svelte';
  import Auth from './guides/Auth.svelte';
  import FirstScreen from './guides/FirstScreen.svelte';
  import Forms from './guides/Forms.svelte';
  import Push from './guides/Push.svelte';
  import Theming from './guides/Theming.svelte';
  import { router } from './router.svelte.js';

  const props: { client: TarolClient } = $props();
  setTarol(untrack(() => props.client));
  const guides = [
    { slug: 'first-screen', title: 'A first screen', page: FirstScreen },
    { slug: 'forms', title: 'Forms', page: Forms },
    { slug: 'push', title: 'Push', page: Push },
    { slug: 'theming', title: 'Theming', page: Theming },
    { slug: 'auth', title: 'Auth', page: Auth },
  ];
  // ?theme=dark&density=compact select the initial look (the screenshot tests use it)
  const search = new URLSearchParams(location.search);
  let theme = $state<'auto' | 'light' | 'dark'>((search.get('theme') as 'light' | 'dark' | null) ?? 'auto');
  let density = $state<'comfortable' | 'compact'>(search.get('density') === 'compact' ? 'compact' : 'comfortable');
  const parts = $derived(router.route.parts);
  const component = $derived(parts[0] === 'components' ? pages.find((p) => p.name === parts[1]) : undefined);
  const guide = $derived(parts[0] === 'guides' ? guides.find((g) => g.slug === parts[1]) : undefined);
</script>

<ThemeRoot {theme} {density}>
  <AppShell title="tarol-svelte" navLabel="Docs">
    {#snippet nav()}
      <details open>
        <summary>Components</summary>
        <ul>
          {#each pages as p (p.name)}<li>
              <a href="#/components/{p.name}" aria-current={component === p ? 'page' : undefined}>{p.name}</a>
            </li>{/each}
        </ul>
      </details>
      <details open>
        <summary>Guides</summary>
        <ul>
          {#each guides as g (g.slug)}<li>
              <a href="#/guides/{g.slug}" aria-current={guide === g ? 'page' : undefined}>{g.title}</a>
            </li>{/each}
          <li><a href="#/tokens">Tokens</a></li>
          <li><a href="#/auctions">Example: ArtFlow (needs the sample)</a></li>
        </ul>
      </details>
    {/snippet}
    {#snippet actions()}
      <label>
        Theme <select bind:value={theme}>
          <option value="auto">auto</option><option value="light">light</option><option value="dark">dark</option>
        </select>
      </label>
      <label>
        Density <select bind:value={density}>
          <option value="comfortable">comfortable</option><option value="compact">compact</option>
        </select>
      </label>
      {#if parts[0] === 'auctions'}
        <SearchBox
          label="Search"
          onselect={(hit) => {
            router.go(`#/auctions/${hit.aggregate}`);
          }}
        />
      {/if}
    {/snippet}
    {#if component}
      <Demo>
        {#key component}<Page page={component} />{/key}
      </Demo>
    {:else if guide}
      {@const G = guide.page}
      <G />
    {:else if parts[0] === 'tokens'}
      <Tokens />
    {:else if parts[0] === 'auctions' && parts[1]}
      {#key parts[1]}<Auction id={parts[1]} />{/key}
    {:else if parts[0] === 'auctions'}
      <Auctions />
    {:else if parts[0] === 'subjects' && parts[1]}
      <Subject id={parts[1]} tenant={router.route.query.get('tenant') ?? '00000000-0000-0000-0000-000000000000'} />
    {:else}
      <h1>tarol-svelte</h1>
      <p>
        The browser side of Tarol: a framework-free client, Svelte 5 runes, a design system and default components.
        Start with <a href="#/guides/first-screen">a first screen</a> or browse the components.
      </p>
    {/if}
  </AppShell>
</ThemeRoot>
