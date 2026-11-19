<!--
  @component
  The page frame: a skip link, a header with the app's name and actions, an optional navigation and the main landmark.
-->
<script lang="ts">
  import { getMessages } from '@clorat/tarol-design';
  import type { Snippet } from 'svelte';

  interface Props {
    /** The app's name in the header. */
    title: string;
    /** The navigation's accessible name (the app's own text); the nav is rendered when `nav` is set. */
    navLabel?: string | undefined;
    /** Navigation links. */
    nav?: Snippet | undefined;
    /** Header actions (user menu, sign-out). */
    actions?: Snippet | undefined;
    /** The page. */
    children: Snippet;
  }

  let { title, navLabel, nav, actions, children }: Props = $props();
  const t = getMessages();
</script>

<a class="t-skip" href="#t-main">{t('ui.skip')}</a>
<div class="t-shell" data-nav={nav ? '' : undefined}>
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
  }
</style>
