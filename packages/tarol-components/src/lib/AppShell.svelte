<!--
  @component
  The page frame: a skip link, a header with the app's name and actions, an optional navigation and the main landmark.
  Below 40rem the navigation is stacked above the page (`navPosition="side"`, the default) or a one-row bar at the bottom
  of the viewport, in thumb reach (`navPosition="bottom"`: its list items share the row, each target at least 44 px high).
-->
<script lang="ts">
  import { getMessages } from '@clorat/tarol-design';
  import type { Snippet } from 'svelte';

  interface Props {
    /** The app's name in the header. */
    title: string;
    /** The navigation's accessible name (the app's own text); the nav is rendered when `nav` is set. */
    navLabel?: string | undefined;
    /** Navigation links (a `<ul>` of links, or links). */
    nav?: Snippet | undefined;
    /** Where the navigation goes below 40rem: stacked above the page (`side`, default) or a bar at the bottom (`bottom`). */
    navPosition?: 'side' | 'bottom' | undefined;
    /** Header actions (user menu, sign-out). */
    actions?: Snippet | undefined;
    /** The page. */
    children: Snippet;
  }

  let { title, navLabel, nav, navPosition = 'side', actions, children }: Props = $props();
  const t = getMessages();
</script>

<a class="t-skip" href="#t-main">{t('ui.skip')}</a>
<div class="t-shell" data-nav={nav ? navPosition : undefined}>
  <header class="t-shell-header">
    <span class="t-shell-title">{title}</span>
    {#if actions}<div class="t-shell-actions">{@render actions()}</div>{/if}
  </header>
  {#if nav}<nav class="t-shell-nav" aria-label={navLabel}>{@render nav()}</nav>{/if}
  <main id="t-main" class="t-shell-main" tabindex="-1">{@render children()}</main>
</div>

<style>
  .t-skip {
    position: absolute;
    inset-inline-start: var(--t-space-2);
    inset-block-start: -10rem;
    z-index: var(--t-z-toast);
    padding: var(--t-space-2) var(--t-space-3);
    border-radius: var(--t-radius-2);
    background: var(--t-color-accent);
    color: var(--t-color-accent-fg);
  }
  .t-skip:focus {
    inset-block-start: var(--t-space-2);
  }
  .t-shell {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 100dvh;
  }
  .t-shell[data-nav] {
    grid-template-columns: minmax(10rem, 14rem) 1fr;
  }
  .t-shell-header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--t-space-4);
    padding: var(--t-space-3) var(--t-space-6);
    border-bottom: 1px solid var(--t-color-border);
  }
  .t-shell-title {
    font-weight: var(--t-weight-bold);
  }
  .t-shell-nav {
    padding: var(--t-space-4);
    border-inline-end: 1px solid var(--t-color-border);
  }
  .t-shell-main {
    padding: var(--t-space-6);
    min-width: 0;
  }
  .t-shell-main:focus {
    outline: none;
  }
  @media (max-width: 40rem) {
    .t-shell[data-nav] {
      grid-template-columns: 1fr;
    }
    .t-shell-nav {
      border-inline-end: 0;
      border-bottom: 1px solid var(--t-color-border);
    }
    /* bottom: the nav after the page in the grid, sticky at the viewport's bottom edge */
    .t-shell[data-nav='bottom'] {
      grid-template-rows: auto 1fr auto;
    }
    .t-shell[data-nav='bottom'] .t-shell-main {
      grid-row: 2;
    }
    .t-shell[data-nav='bottom'] .t-shell-nav {
      grid-row: 3;
      position: sticky;
      inset-block-end: 0;
      z-index: 1; /* above the page, below dialogs and toasts */
      padding: 0 0 env(safe-area-inset-bottom);
      border-bottom: 0;
      border-top: 1px solid var(--t-color-border);
      background: var(--t-color-bg);
    }
    .t-shell[data-nav='bottom'] .t-shell-nav :global(ul) {
      display: flex;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .t-shell[data-nav='bottom'] .t-shell-nav :global(li) {
      flex: 1 1 0;
      min-width: 0;
    }
    .t-shell[data-nav='bottom'] .t-shell-nav :global(a) {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 2.75rem;
      padding-inline: var(--t-space-1);
      text-align: center;
      overflow-wrap: anywhere;
    }
  }
</style>
