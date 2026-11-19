<!--
  @component
  A labelled date input on the native `input type=date`: the browser supplies the localized format, the picker and its
  keyboard support. The value is an ISO date (`YYYY-MM-DD`, as a backend `DateOnly` is serialized) or `null` when empty.
-->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import Field from './Field.svelte';

  interface Props extends Omit<HTMLInputAttributes, 'value' | 'type' | 'min' | 'max'> {
    /** The visible label. */
    label: string;
    /** The date as `YYYY-MM-DD`, or `null` (bindable). */
    value?: string | null | undefined;
    /** The earliest date, `YYYY-MM-DD`. */
    min?: string | undefined;
    /** The latest date, `YYYY-MM-DD`. */
    max?: string | undefined;
    /** Help text under the input. */
    hint?: string | undefined;
    /** The error text, already translated. */
    error?: string | undefined;
    /** Marks the field as required. */
    required?: boolean | undefined;
  }

  let { label, value = $bindable(null), min, max, hint, error, required = false, ...rest }: Props = $props();
</script>

<Field {label} {hint} {error} {required}>
  {#snippet control(c)}
    <input
      {...rest}
      {...c}
      type="date"
      class="t-input"
      {min}
      {max}
      {required}
      value={value ?? ''}
      oninput={(e) => (value = e.currentTarget.value === '' ? null : e.currentTarget.value)}
    />
  {/snippet}
</Field>

<style>
  .t-input {
    min-height: var(--t-control-height);
    padding: 0 var(--t-space-3);
    border: 1px solid var(--t-color-border-strong);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg);
    color: var(--t-color-fg);
    font: inherit;
  }
  .t-input[aria-invalid='true'] {
    border-color: var(--t-color-danger);
  }
</style>
