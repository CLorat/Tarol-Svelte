<!--
  @component
  A choice from a few options as radio buttons in a `fieldset` (a `radiogroup` named by its legend): the arrow keys move
  the choice (native), every option is a target of at least 44 px, hint and error are wired with `aria-describedby`.
-->
<script module lang="ts">
  /** The props of RadioGroup. */
  export interface RadioGroupProps<V extends string> {
    /** The visible legend (the app's own, translated text). */
    label: string;
    /** The choices: the backend's value, its text and an optional line of help. */
    options: readonly { readonly value: V; readonly label: string; readonly hint?: string | undefined }[];
    /** The chosen value, or `null` (bindable). */
    value?: V | null | undefined;
    /** Help text under the legend. */
    hint?: string | undefined;
    /** The error text, already translated. */
    error?: string | undefined;
    /** Marks the group as required. */
    required?: boolean | undefined;
  }
</script>

<script lang="ts" generics="V extends string">
  import { getMessages } from './messages.js';

  let { label, options, value = $bindable(null), hint, error, required = false }: RadioGroupProps<V> = $props();
  const t = getMessages();
  const id = $props.id();
  const describedBy = $derived(
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
  );
</script>

<fieldset
  class="t-radios"
  role="radiogroup"
  aria-labelledby="{id}-legend"
  aria-describedby={describedBy}
  aria-invalid={error ? 'true' : undefined}
  aria-required={required ? 'true' : undefined}
>
  <legend id="{id}-legend">
    {label}{#if required}<span class="t-required">&nbsp;({t('ui.required')})</span>{/if}
  </legend>
  {#if hint}<p id="{id}-hint" class="t-hint">{hint}</p>{/if}
  {#each options as option, i (option.value)}
    <label class="t-radio">
      <input
        type="radio"
        name={id}
        value={option.value}
        checked={value === option.value}
        aria-describedby={option.hint ? `${id}-${String(i)}` : undefined}
        onchange={() => (value = option.value)}
      />
      <span class="t-radio-text">
        <span>{option.label}</span>
        {#if option.hint}<span id="{id}-{i}" class="t-hint">{option.hint}</span>{/if}
      </span>
    </label>
  {/each}
  {#if error}<p id="{id}-error" class="t-error">{error}</p>{/if}
</fieldset>

<style>
  .t-radios {
    display: grid;
    gap: var(--t-space-2);
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: none;
    font-size: var(--t-text-sm);
  }
  legend {
    padding: 0;
    font-weight: var(--t-weight-medium);
  }
  .t-required {
    font-weight: normal;
    color: var(--t-color-fg-muted);
  }
  /* a 44 px target per option (WCAG 2.5.8 asks 24 px; thumb use asks more) */
  .t-radio {
    display: flex;
    gap: var(--t-space-2);
    align-items: flex-start;
    min-height: 2.75rem;
    padding: var(--t-space-2) var(--t-space-3);
    border: 1px solid var(--t-color-border);
    border-radius: var(--t-radius-2);
    cursor: pointer;
  }
  .t-radio:has(input:checked) {
    border-color: var(--t-color-accent);
  }
  .t-radio:has(input:focus-visible) {
    outline: 2px solid var(--t-color-focus);
    outline-offset: 2px;
  }
  input {
    flex: none;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    margin: 0.125rem 0 0;
    accent-color: var(--t-color-accent);
  }
  .t-radio-text {
    display: grid;
    gap: var(--t-space-1);
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
  .t-radios[aria-invalid='true'] .t-radio {
    border-color: var(--t-color-danger);
  }
</style>
