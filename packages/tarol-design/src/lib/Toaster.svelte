<!--
  @component
  The notification region of a ThemeRoot (rendered by it). Errors are announced assertively, the others politely.
-->
<script lang="ts">
  import { getMessages } from './messages.js';
  import { getToasts } from './toasts.svelte.js';

  const toasts = getToasts();
  const t = getMessages();
</script>

<section class="t-toaster" aria-label={t('ui.notifications')}>
  <div role="status" aria-live="polite">
    {#each toasts.items.filter((x) => x.kind !== 'error') as toast (toast.id)}
      <div class="t-toast" data-kind={toast.kind}>
        <p>{toast.text}</p>
        <button
          type="button"
          aria-label={t('ui.dismiss')}
          onclick={() => {
            toasts.dismiss(toast.id);
          }}
        >
          ×
        </button>
      </div>
    {/each}
  </div>
  <div role="alert" aria-live="assertive">
    {#each toasts.items.filter((x) => x.kind === 'error') as toast (toast.id)}
      <div class="t-toast" data-kind="error">
        <p>{toast.text}</p>
        <button
          type="button"
          aria-label={t('ui.dismiss')}
          onclick={() => {
            toasts.dismiss(toast.id);
          }}
        >
          ×
        </button>
      </div>
    {/each}
  </div>
</section>

<style>
  .t-toaster {
    position: fixed;
    inset-block-end: var(--t-space-4);
    inset-inline-end: var(--t-space-4);
    z-index: var(--t-z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--t-space-2);
    max-width: min(24rem, calc(100vw - 2rem));
  }
  .t-toaster > div {
    display: contents;
  }
  .t-toast {
    display: flex;
    align-items: start;
    gap: var(--t-space-3);
    padding: var(--t-space-3) var(--t-space-4);
    border: 1px solid var(--t-color-border);
    border-inline-start: 4px solid var(--t-color-accent);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg);
    color: var(--t-color-fg);
    box-shadow: var(--t-shadow-3);
    font-size: var(--t-text-sm);
  }
  .t-toast[data-kind='success'] {
    border-inline-start-color: var(--t-color-success);
  }
  .t-toast[data-kind='error'] {
    border-inline-start-color: var(--t-color-danger);
  }
  p {
    margin: 0;
    flex: 1;
  }
  button {
    border: 0;
    background: transparent;
    color: var(--t-color-fg-muted);
    cursor: pointer;
    font: inherit;
  }
</style>
