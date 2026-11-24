<!--
  @component
  Label, hint and error around one control. The control snippet receives the ids to wire: `id`, `aria-describedby` and
  `aria-invalid`, so the error is announced with the field.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getMessages } from './messages.js';

  /** What the control snippet receives. */
  interface Control {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': 'true' | undefined;
    'aria-required': 'true' | undefined;
  }

  interface Props {
    /** The visible label (the app's own, already translated text). */
    label: string;
    /** Help text under the control. */
    hint?: string | undefined;
    /** The error text (already translated, e.g. `t(form.error(path))`); shown and announced when set. */
    error?: string | undefined;
    /** Marks the field as required (label suffix and `aria-required`). */
    required?: boolean | undefined;
    /** The control. */
    control: Snippet<[Control]>;
  }

  let { label, hint, error, required = false, control }: Props = $props();
  const t = getMessages();
  const id = $props.id();
  const describedBy = $derived(
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
  );
</script>

<div class="t-field">
  <label for={id}>
    <!-- a no-break space: Svelte drops leading whitespace (also `&#32;`), and the marker never wraps alone (TS-5) -->
    {label}{#if required}&nbsp;<span class="t-required">({t('ui.required')})</span>{/if}
  </label>
  {@render control({
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? 'true' : undefined,
    'aria-required': required ? 'true' : undefined,
  })}
  {#if hint}<p id="{id}-hint" class="t-hint">{hint}</p>{/if}
  {#if error}<p id="{id}-error" class="t-error">{error}</p>{/if}
</div>

<style>
  .t-field {
    display: flex;
    flex-direction: column;
    gap: var(--t-space-1);
    font-size: var(--t-text-sm);
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
    font-size: var(--t-text-xs);
  }
  .t-hint {
    color: var(--t-color-fg-muted);
  }
  .t-error {
    color: var(--t-color-danger);
  }
</style>
