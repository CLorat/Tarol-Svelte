<!--
  @component
  Tabs (WAI-ARIA APG tabs, automatic activation): one tab stop for the tab list; Arrow Left/Right move and select (wrapping),
  Home/End go to the first and last tab. Only the selected panel is rendered; it is focusable so its content can be reached
  with Tab. More tabs than fit scroll inside the tab list; the focused tab scrolls into view.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** One tab. */
  interface Tab {
    /** A stable id, the value of `selected`. */
    id: string;
    /** The tab's text (already translated). */
    label: string;
  }

  interface Props {
    /** The tabs, in order. */
    tabs: readonly Tab[];
    /** The selected tab's id (bindable). Default: the first tab. */
    selected?: string | undefined;
    /** The tab list's accessible name (already translated). */
    label: string;
    /** Renders the selected panel; receives the selected id. */
    children: Snippet<[string]>;
    /** Called after the selection changed. */
    onchange?: ((id: string) => void) | undefined;
  }

  let { tabs, selected = $bindable(), label, children, onchange }: Props = $props();
  const id = $props.id();
  const current = $derived(tabs.some((t) => t.id === selected) ? selected : tabs[0]?.id);
  const buttons: HTMLButtonElement[] = $state([]);

  function select(index: number): void {
    const tab = tabs[index];
    if (!tab) return;
    selected = tab.id;
    buttons[index]?.focus();
    onchange?.(tab.id);
  }

  function keydown(e: KeyboardEvent, index: number): void {
    const last = tabs.length - 1;
    const next =
      e.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : e.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
  }
</script>

<div class="t-tabs">
  <div role="tablist" aria-label={label} class="t-tablist">
    {#each tabs as tab, i (tab.id)}
      <button
        bind:this={buttons[i]}
        type="button"
        role="tab"
        id="{id}-tab-{i}"
        class="t-tab"
        aria-selected={tab.id === current}
        aria-controls="{id}-panel"
        tabindex={tab.id === current ? 0 : -1}
        onclick={() => {
          select(i);
        }}
        onkeydown={(e) => {
          keydown(e, i);
        }}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  {#if current !== undefined}
    <div
      role="tabpanel"
      id="{id}-panel"
      class="t-tabpanel"
      tabindex="0"
      aria-labelledby="{id}-tab-{tabs.findIndex((t) => t.id === current)}"
    >
      {@render children(current)}
    </div>
  {/if}
</div>

<style>
  /* many tabs on a narrow screen: the list scrolls in itself (the focused tab is scrolled into view), never the page (TS-18) */
  .t-tablist {
    display: flex;
    gap: var(--t-space-1);
    /* the line under the tabs as a shadow: a border with the tabs' -1px overlap would scroll the list vertically */
    box-shadow: inset 0 -1px 0 var(--t-color-border);
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .t-tab {
    flex: none;
    white-space: nowrap;
    min-height: var(--t-control-height);
    padding: 0 var(--t-space-3);
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--t-color-fg-muted);
    font: inherit;
    font-size: var(--t-text-sm);
    cursor: pointer;
  }
  /* inside the tab: the scrolling list would clip a ring drawn outside it */
  .t-tab:focus-visible {
    outline: 2px solid var(--t-color-focus);
    outline-offset: -2px;
  }
  .t-tab[aria-selected='true'] {
    border-bottom-color: var(--t-color-accent);
    color: var(--t-color-fg);
    font-weight: var(--t-weight-medium);
  }
  .t-tabpanel {
    padding: var(--t-space-4) 0;
  }
</style>
