<!--
  @component
  A labelled checkbox (a consent, a yes/no setting): the box before its label, the hint and the error under it, wired with
  `aria-describedby` and `aria-invalid` like every field, so the error is announced with the box.
-->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { getMessages } from './messages.js';

  interface Props extends Omit<HTMLInputAttributes, 'checked' | 'type' | 'value'> {
    /** The visible label (the app's own, already translated text). */
    label: string;
    /** Whether it is checked (bindable). */
    checked?: boolean | undefined;
    /** Help text under the box. */
    hint?: string | undefined;
    /** The error text, already translated. */
    error?: string | undefined;
    /** Marks the box as required (label suffix and `aria-required`): a consent that must be given. */
    required?: boolean | undefined;
  }

  let { label, checked = $bindable(false), hint, error, required = false, ...rest }: Props = $props();
  const t = getMessages();
  const id = $props.id();
  const describedBy = $derived(
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
  );
</script>

<div class="t-checkbox">
  <div class="t-checkbox-row">
    <input
      {...rest}
      {id}
      type="checkbox"
      class="t-checkbox-box"
      aria-describedby={describedBy}
      aria-invalid={error ? 'true' : undefined}
      aria-required={required ? 'true' : undefined}
      {required}
      bind:checked
    />
    <label for={id}>
      {label}{#if required}<span class="t-required">&nbsp;({t('ui.required')})</span>{/if}
    </label>
  </div>
  {#if hint}<p id="{id}-hint" class="t-hint">{hint}</p>{/if}
  {#if error}<p id="{id}-error" class="t-error">{error}</p>{/if}
</div>

<style>
  .t-checkbox {
    display: flex;
    flex-direction: column;
    gap: var(--t-space-1);
    font-size: var(--t-text-sm);
  }
  .t-checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: var(--t-space-2);
  }
  /* a 24 px target at least (WCAG 2.5.8), aligned with the first line of the label */
  .t-checkbox-box {
    flex: none;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    margin: 0.125rem 0 0;
    accent-color: var(--t-color-accent);
  }
  .t-checkbox-box[aria-invalid='true'] {
    outline: 2px solid var(--t-color-danger);
    outline-offset: 1px;
  }
  label {
    font-weight: var(--t-weight-medium);
  }
  .t-required {
    font-weight: normal;
    color: var(--t-color-fg-muted);
  }
  .t-hint,
  .t-error {
    margin: 0;
    padding-inline-start: calc(1.25rem + var(--t-space-2));
    font-size: var(--t-text-xs);
  }
  .t-hint {
    color: var(--t-color-fg-muted);
  }
  .t-error {
    color: var(--t-color-danger);
  }
</style>
