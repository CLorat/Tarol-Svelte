<script lang="ts">
  import { asId, isId, type TarolClient } from '@clorat/tarol-client';
  import type { PushClient } from '@clorat/tarol-client/push';
  import type { Oidc } from '@clorat/tarol-oidc';
  import { AdminApp } from '@clorat/tarol-admin';
  import { AppShell, SearchBox } from '@clorat/tarol-components';
  import { Button, ThemeRoot } from '@clorat/tarol-design';
  import { setTarol } from '@clorat/tarol-svelte';
  import { untrack } from 'svelte';
  import Auction from './artflow/Auction.svelte';
  import Auctions from './artflow/Auctions.svelte';
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

  const props: { client: TarolClient; push?: PushClient; oidc?: Oidc } = $props();
  // the GitHub Pages build (SV-21) has no backend: the ArtFlow and admin screens are left out
  const pagesBuild = import.meta.env['VITE_TAROL_PAGES'] === '1';
  const oidc = untrack(() => props.oidc);
  let session = $state(oidc?.session() ?? null);
  oidc?.subscribe((s) => (session = s));
  setTarol(
    untrack(() => props.client),
    untrack(() => props.push),
  );
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
          {#if !pagesBuild}
            <li><a href="#/auctions">Example: ArtFlow (needs the sample)</a></li>
            <li><a href="#/admin">Example: admin (needs the sample, tarol-admin)</a></li>
          {/if}
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
      {#if oidc}
        {#if session}
          <span data-testid="user">{session.subject}</span>
          <Button variant="secondary" onclick={() => void oidc.logout()}>Sign out</Button>
        {:else}
          <Button onclick={() => void oidc.login()}>Sign in</Button>
        {/if}
      {/if}
      {#if parts[0] === 'auctions' && !pagesBuild}
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
    {:else if pagesBuild && (parts[0] === 'auctions' || parts[0] === 'admin')}
      <h1>Needs the sample</h1>
      <p data-testid="needs-sample">
        This example screen calls the ArtFlow sample (<code>samples/Sagas</code> in Tarol-Net), which this static site does
        not have. Run the docs app locally next to the sample (<code>pnpm --filter @clorat/tarol-docs dev</code>).
      </p>
    {:else if parts[0] === 'auctions' && parts[1]}
      <!-- the route value becomes the branded id once, at the boundary; anything else is not an auction -->
      {#if isId(parts[1])}
        {#key parts[1]}<Auction id={asId<'Auction'>(parts[1])} />{/key}
      {:else}
        <h1>Not found</h1>
      {/if}
    {:else if parts[0] === 'auctions'}
      <Auctions />
    {:else if parts[0] === 'admin'}
      <h1>Administration</h1>
      <AdminApp />
    {:else}
      <h1>tarol-svelte</h1>
      <p>
        The browser side of Tarol: a framework-free client, Svelte 5 runes, a design system and default components.
        Start with <a href="#/guides/first-screen">a first screen</a> or browse the components.
      </p>
    {/if}
  </AppShell>
</ThemeRoot>
