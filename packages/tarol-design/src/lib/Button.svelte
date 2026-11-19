<!--
  @component
  A button. `type` defaults to `button` (never an accidental submit); `loading` disables it, shows a spinner and sets
  `aria-busy`.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Spinner from './Spinner.svelte';

  interface Props extends HTMLButtonAttributes {
    /** `primary` (default), `secondary`, `danger` or `ghost`. */
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | undefined;
    /** Shows a spinner and disables the button. */
    loading?: boolean | undefined;
    children: Snippet;
  }

  let { variant = 'primary', loading = false, type = 'button', disabled, children, ...rest }: Props = $props();
</script>

<button
  {...rest}
  {type}
  class="t-button"
  data-variant={variant}
  disabled={(disabled ?? false) || loading}
  aria-busy={loading || undefined}
>
  {#if loading}<Spinner size="1em" />{/if}
  {@render children()}
</button>

<style>
  .t-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--t-space-2);
    min-height: var(--t-control-height);
    padding: 0 var(--t-space-4);
    border: 1px solid transparent;
    border-radius: var(--t-radius-2);
    font: inherit;
    font-size: var(--t-text-sm);
    font-weight: var(--t-weight-medium);
    cursor: pointer;
    background: var(--t-color-accent);
    color: var(--t-color-accent-fg);
    transition: background var(--t-duration-fast) var(--t-ease);
  }
  .t-button:hover:not(:disabled) {
    background: var(--t-color-accent-hover);
  }
  .t-button[data-variant='secondary'] {
    background: var(--t-color-bg);
    color: var(--t-color-fg);
    border-color: var(--t-color-border-strong);
  }
  .t-button[data-variant='secondary']:hover:not(:disabled),
  .t-button[data-variant='ghost']:hover:not(:disabled) {
    background: var(--t-color-bg-muted);
  }
  .t-button[data-variant='danger'] {
    background: var(--t-color-danger);
    color: var(--t-color-danger-fg);
  }
  .t-button[data-variant='danger']:hover:not(:disabled) {
    background: var(--t-color-danger-hover);
  }
  .t-button[data-variant='ghost'] {
    background: transparent;
    color: var(--t-color-fg);
  }
  .t-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
