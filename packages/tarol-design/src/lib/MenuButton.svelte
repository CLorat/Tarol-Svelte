<!--
  @component
  A menu button (WAI-ARIA APG menu button) on the native `popover`: Enter, Space or Arrow Down open the menu on its first
  item, Arrow Up on its last; Arrow keys move (wrapping), Home/End, Enter or Space choose, Escape closes and returns focus
  to the button, Tab closes. A click outside closes it (light dismiss). Use it for actions, not for choosing a value.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** One action. */
  interface Item {
    /** A stable id, passed to `onselect`. */
    id: string;
    /** The item's text (already translated). */
    label: string;
    /** Shown but not choosable. */
    disabled?: boolean | undefined;
  }

  interface Props {
    /** The actions, in order. */
    items: readonly Item[];
    /** The button's content (text, or an icon with a `VisuallyHidden` text). */
    children: Snippet;
    /** Called with the chosen item's id; the menu is closed by then. */
    onselect: (id: string) => void;
    /** `secondary` (default) or `ghost`. */
    variant?: 'secondary' | 'ghost' | undefined;
  }

  let { items, children, onselect, variant = 'secondary' }: Props = $props();
  const id = $props.id();
  let button = $state<HTMLButtonElement>();
  let menu = $state<HTMLDivElement>();
  let open = $state(false);
  const entries: HTMLElement[] = $state([]);

  const enabled = (): number[] => items.flatMap((item, i) => (item.disabled ? [] : [i]));

  let focusAt: 'first' | 'last' = 'first';

  function show(at: 'first' | 'last'): void {
    focusAt = at;
    menu?.showPopover();
  }

  function toggled(e: ToggleEvent): void {
    open = e.newState === 'open';
    if (!open) return;
    const list = enabled();
    entries[(focusAt === 'first' ? list[0] : list.at(-1)) ?? 0]?.focus();
    focusAt = 'first';
  }

  function close(focusButton: boolean): void {
    if (menu?.matches(':popover-open')) menu.hidePopover();
    if (focusButton) button?.focus();
  }

  function choose(index: number): void {
    const item = items[index];
    if (!item || item.disabled) return;
    close(true);
    onselect(item.id);
  }

  function buttonKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      show(e.key === 'ArrowDown' ? 'first' : 'last');
    }
  }

  function menuKey(e: KeyboardEvent, index: number): void {
    const list = enabled();
    const at = list.indexOf(index);
    let next: number | undefined;
    if (e.key === 'ArrowDown') next = list[(at + 1) % list.length];
    else if (e.key === 'ArrowUp') next = list[(at - 1 + list.length) % list.length];
    else if (e.key === 'Home') next = list[0];
    else if (e.key === 'End') next = list.at(-1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(index);
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    } else if (e.key === 'Tab') {
      close(false);
      return;
    }
    if (next === undefined) return;
    e.preventDefault();
    entries[next]?.focus();
  }
</script>

<button
  bind:this={button}
  type="button"
  class="t-menubutton t-menubutton-{variant}"
  aria-haspopup="menu"
  aria-expanded={open}
  aria-controls="{id}-menu"
  popovertarget="{id}-menu"
  style:anchor-name="--{id}"
  onkeydown={buttonKey}
>
  {@render children()}
</button>
<div
  bind:this={menu}
  id="{id}-menu"
  role="menu"
  popover="auto"
  class="t-menu"
  style:position-anchor="--{id}"
  ontoggle={toggled}
>
  {#each items as item, i (item.id)}
    <div
      bind:this={entries[i]}
      role="menuitem"
      tabindex="-1"
      class="t-menuitem"
      aria-disabled={item.disabled ? 'true' : undefined}
      onclick={() => {
        choose(i);
      }}
      onkeydown={(e) => {
        menuKey(e, i);
      }}
    >
      {item.label}
    </div>
  {/each}
</div>

<style>
  .t-menubutton {
    display: inline-flex;
    align-items: center;
    gap: var(--t-space-2);
    min-height: var(--t-control-height);
    padding: 0 var(--t-space-3);
    border: 1px solid var(--t-color-border-strong);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg);
    color: var(--t-color-fg);
    font: inherit;
    font-size: var(--t-text-sm);
    cursor: pointer;
  }
  .t-menubutton-ghost {
    border-color: transparent;
    background: none;
  }
  .t-menu {
    position: fixed;
    inset: auto;
    top: anchor(bottom);
    left: anchor(left);
    position-try-fallbacks: flip-block, flip-inline;
    min-width: max(10rem, anchor-size(width));
    margin: var(--t-space-1) 0 0;
    padding: var(--t-space-1);
    border: 1px solid var(--t-color-border);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg);
    color: var(--t-color-fg);
    box-shadow: var(--t-shadow-3);
  }
  .t-menuitem {
    padding: var(--t-space-2) var(--t-space-3);
    border-radius: var(--t-radius-1);
    font-size: var(--t-text-sm);
    cursor: pointer;
  }
  .t-menuitem:hover,
  .t-menuitem:focus {
    background: var(--t-color-bg-muted);
  }
  .t-menuitem:focus-visible {
    outline: 2px solid var(--t-color-focus);
    outline-offset: -2px;
  }
  .t-menuitem[aria-disabled='true'] {
    color: var(--t-color-fg-muted);
    cursor: default;
  }
</style>
