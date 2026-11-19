<!--
  @component
  A labelled number input; the bound value is a `number`, or `null` when empty.
-->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import Field from './Field.svelte';

  interface Props extends Omit<HTMLInputAttributes, 'value' | 'type'> {
    /** The visible label. */
    label: string;
    /** The value (bindable); `null` when the input is empty. */
    value?: number | null | undefined;
    /** Help text under the input. */
    hint?: string | undefined;
    /** The error text, already translated. */
    error?: string | undefined;
    /** Marks the field as required. */
    required?: boolean | undefined;
  }

  let { label, value = $bindable(null), hint, error, required = false, ...rest }: Props = $props();
</script>

<Field {label} {hint} {error} {required}>
  {#snippet control(c)}
    <input {...rest} {...c} {required} type="number" inputmode="decimal" class="t-input" bind:value />
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
    font-variant-numeric: tabular-nums;
  }
  .t-input[aria-invalid='true'] {
    border-color: var(--t-color-danger);
  }
</style>
