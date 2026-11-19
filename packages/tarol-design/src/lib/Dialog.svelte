<!--
  @component
  A modal dialog on the native `<dialog>`: the browser traps focus, makes the page inert and closes it on Escape. Focus
  returns to the element that opened it. A click on the backdrop closes it unless `dismissible` is false.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getMessages } from './messages.js';

  interface Props {
    /** Open state (bindable). */
    open?: boolean | undefined;
    /** The heading, the dialog's accessible name. */
    title: string;
    /** Backdrop click and Escape close it. Default `true`. */
    dismissible?: boolean | undefined;
    /** The body. */
    children: Snippet;
    /** Actions at the bottom (buttons). */
    footer?: Snippet | undefined;
    /** Called after it closed, however it closed. */
    onclose?: (() => void) | undefined;
  }

  let { open = $bindable(false), title, dismissible = true, children, footer, onclose }: Props = $props();
  const t = getMessages();
  const id = $props.id();
  let dialog = $state<HTMLDialogElement>();
  let opener: Element | null = null;

  $effect(() => {
    const d = dialog;
    if (!d) return;
    if (open && !d.open) {
      opener = document.activeElement;
      d.showModal();
    } else if (!open && d.open) d.close();
  });

  function closed(): void {
    open = false;
    if (opener instanceof HTMLElement) opener.focus();
    opener = null;
    onclose?.();
  }
</script>

<dialog
  bind:this={dialog}
  class="t-dialog"
  aria-labelledby="{id}-title"
  onclose={closed}
  oncancel={(e) => {
    if (!dismissible) e.preventDefault();
  }}
  onclick={(e) => {
    if (dismissible && e.target === dialog) dialog.close();
  }}
>
  <div class="t-dialog-panel">
    <header>
      <h2 id="{id}-title">{title}</h2>
      {#if dismissible}
        <button type="button" class="t-dialog-close" aria-label={t('ui.close')} onclick={() => dialog?.close()}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.75" />
          </svg>
        </button>
      {/if}
    </header>
    <div class="t-dialog-body">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</dialog>

<style>
  .t-dialog {
    max-width: min(32rem, calc(100vw - 2rem));
    width: 100%;
    padding: 0;
    border: 1px solid var(--t-color-border);
    border-radius: var(--t-radius-3);
    background: var(--t-color-bg);
    color: var(--t-color-fg);
    box-shadow: var(--t-shadow-3);
  }
  .t-dialog::backdrop {
    background: var(--t-color-backdrop);
  }
  .t-dialog-panel {
    padding: var(--t-space-6);
    display: flex;
    flex-direction: column;
    gap: var(--t-space-4);
  }
  header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--t-space-4);
  }
  h2 {
    margin: 0;
    font-size: var(--t-text-lg);
  }
  .t-dialog-close {
    display: inline-flex;
    padding: var(--t-space-1);
    border: 0;
    border-radius: var(--t-radius-1);
    background: transparent;
    color: var(--t-color-fg-muted);
    cursor: pointer;
  }
  footer {
    display: flex;
    justify-content: end;
    gap: var(--t-space-2);
  }
</style>
