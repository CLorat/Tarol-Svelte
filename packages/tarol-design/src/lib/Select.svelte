<!--
  @component
  A labelled choice from a list on the native `select` (keyboard, type-ahead and the phone's picker come from the browser).
  The value is the chosen option's `value`, or `null` while the placeholder is shown.
-->
<script module lang="ts">
  import type { HTMLSelectAttributes } from 'svelte/elements';

  /** The props of Select. */
  export interface SelectProps<V extends string> extends Omit<HTMLSelectAttributes, 'value'> {
    /** The visible label. */
    label: string;
    /** The choices: the backend's value (e.g. an enum member) and its text (the app's own, translated). */
    options: readonly { readonly value: V; readonly label: string }[];
    /** The chosen value, or `null` (bindable). */
    value?: V | null | undefined;
    /** The text of the empty first entry (e.g. "Choose …"); it cannot be chosen again. */
    placeholder?: string | undefined;
    /** Help text under the select. */
    hint?: string | undefined;
    /** The error text, already translated. */
    error?: string | undefined;
    /** Marks the field as required. */
    required?: boolean | undefined;
  }
</script>

<script lang="ts" generics="V extends string">
  import Field from './Field.svelte';

  let {
    label,
    options,
    value = $bindable(null),
    placeholder = '',
    hint,
    error,
    required = false,
    ...rest
  }: SelectProps<V> = $props();
</script>

<Field {label} {hint} {error} {required}>
  {#snippet control(c)}
    <select
      {...rest}
      {...c}
      {required}
      class="t-select"
      value={value ?? ''}
      onchange={(e) => {
        const v = e.currentTarget.value;
        value = options.find((o) => o.value === v)?.value ?? null;
      }}
    >
      <option value="" disabled>{placeholder}</option>
      {#each options as option (option.value)}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  {/snippet}
</Field>

<style>
  .t-select {
    max-width: 100%;
    min-height: var(--t-control-height);
    padding: 0 var(--t-space-3);
    border: 1px solid var(--t-color-border-strong);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg);
    color: var(--t-color-fg);
    font: inherit;
  }
  .t-select[aria-invalid='true'] {
    border-color: var(--t-color-danger);
  }
</style>
