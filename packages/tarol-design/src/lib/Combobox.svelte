<!--
  @component
  A combobox (WAI-ARIA APG editable combobox with list autocomplete) on the native `popover`: typing filters the options
  and opens the list; Arrow Down/Up move the active option (focus stays in the input, `aria-activedescendant`), Enter
  chooses it, Escape closes the list and a second Escape clears the text, Alt+Arrow Down opens without moving. Leaving the
  field restores the chosen option's label. With `filter={false}` the app supplies `options` for the text it gets in
  `onquery` (a server search).
-->
<script lang="ts">
  import Field from './Field.svelte';
  import { getMessages } from './messages.js';

  /** One option. */
  interface Option {
    /** The value `value` takes when it is chosen. */
    value: string;
    /** The option's text (already translated). */
    label: string;
  }

  interface Props {
    /** The visible label. */
    label: string;
    /** The options. */
    options: readonly Option[];
    /** The chosen option's value, or `null` (bindable). */
    value?: string | null | undefined;
    /** Filters `options` by the text (default: contains, ignoring case), or `false` when `options` are already filtered. */
    filter?: ((option: Option, text: string) => boolean) | false | undefined;
    /** Called with the text whenever it changes (for a server search). */
    onquery?: ((text: string) => void) | undefined;
    /** Called after an option was chosen. */
    onchange?: ((value: string | null) => void) | undefined;
    /** Shows the loading text instead of "no results" while the app fetches options. */
    loading?: boolean | undefined;
    /** Help text under the input. */
    hint?: string | undefined;
    /** The error text, already translated. */
    error?: string | undefined;
    /** Marks the field as required. */
    required?: boolean | undefined;
    /** The input's placeholder (already translated). */
    placeholder?: string | undefined;
  }

  let {
    label,
    options,
    value = $bindable(null),
    filter,
    onquery,
    onchange,
    loading = false,
    hint,
    error,
    required = false,
    placeholder,
  }: Props = $props();
  const t = getMessages();
  const id = $props.id();
  const labelOf = (v: string | null | undefined): string => options.find((o) => o.value === v)?.label ?? '';
  let text = $state(labelOf(value));
  let open = $state(false);
  let active = $state(-1);
  let list = $state<HTMLDivElement>();

  const contains = (o: Option, q: string): boolean => o.label.toLocaleLowerCase().includes(q.toLocaleLowerCase());
  const shown = $derived(
    filter === false || text === labelOf(value) ? options : options.filter((o) => (filter ?? contains)(o, text.trim())),
  );

  $effect(() => {
    const l = list;
    if (!l) return;
    if (open && !l.matches(':popover-open')) l.showPopover();
    else if (!open && l.matches(':popover-open')) l.hidePopover();
  });

  function show(): void {
    open = true;
  }

  function hide(): void {
    open = false;
    active = -1;
  }

  function choose(option: Option): void {
    value = option.value;
    text = option.label;
    hide();
    onchange?.(option.value);
  }

  function input(): void {
    active = -1;
    show();
    if (text === '' && value !== null) {
      value = null;
      onchange?.(null);
    }
    onquery?.(text);
  }

  function keydown(e: KeyboardEvent): void {
    const count = shown.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) show();
      if (!e.altKey && count > 0) active = (active + 1) % count;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) show();
      if (count > 0) active = active <= 0 ? count - 1 : active - 1;
    } else if (e.key === 'Enter') {
      const option = shown[active];
      if (open && option) {
        e.preventDefault();
        choose(option);
      }
    } else if (e.key === 'Escape') {
      if (open) hide();
      else if (text !== '') {
        text = '';
        input();
        hide();
      }
    }
  }

  function blur(): void {
    hide();
    // the text always shows the chosen option; a half-typed text is not a value
    text = labelOf(value);
  }
</script>

<Field {label} {hint} {error} {required}>
  {#snippet control(c)}
    <input
      {...c}
      type="text"
      role="combobox"
      class="t-input t-combobox"
      autocomplete="off"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls="{id}-list"
      aria-activedescendant={open && active >= 0 ? `${id}-option-${String(active)}` : undefined}
      {required}
      {placeholder}
      style:anchor-name="--{id}"
      bind:value={text}
      oninput={input}
      onkeydown={keydown}
      onblur={blur}
      onclick={show}
    />
  {/snippet}
</Field>
<div bind:this={list} popover="manual" class="t-listbox" style:position-anchor="--{id}">
  <div id="{id}-list" role="listbox" aria-label={label}>
    {#each shown as option, i (option.value)}
      <!-- pointerdown keeps the focus in the input; the input owns the keyboard (aria-activedescendant) -->
      <!-- svelte-ignore a11y_click_events_have_key_events (keys are handled on the input, APG combobox; design.md §9) -->
      <div
        id="{id}-option-{i}"
        role="option"
        class="t-option"
        aria-selected={option.value === value}
        data-active={i === active ? '' : undefined}
        tabindex="-1"
        onpointerdown={(e) => {
          e.preventDefault();
        }}
        onclick={() => {
          choose(option);
        }}
      >
        {option.label}
      </div>
    {/each}
  </div>
  <div role="status" class="t-option-empty" hidden={shown.length > 0}>
    {#if shown.length === 0}{loading ? t('ui.loading') : t('ui.noResults')}{/if}
  </div>
</div>

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
  .t-listbox {
    position: fixed;
    inset: auto;
    top: anchor(bottom);
    left: anchor(left);
    width: anchor-size(width);
    max-height: 16rem;
    overflow-y: auto;
    margin: var(--t-space-1) 0 0;
    padding: var(--t-space-1);
    border: 1px solid var(--t-color-border);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg);
    color: var(--t-color-fg);
    box-shadow: var(--t-shadow-3);
  }
  .t-option,
  .t-option-empty:not([hidden]) {
    padding: var(--t-space-2) var(--t-space-3);
    border-radius: var(--t-radius-1);
    font-size: var(--t-text-sm);
  }
  .t-option {
    cursor: pointer;
  }
  .t-option[data-active] {
    outline: 2px solid var(--t-color-focus);
    outline-offset: -2px;
    background: var(--t-color-bg-muted);
  }
  .t-option-empty {
    color: var(--t-color-fg-muted);
  }
</style>
