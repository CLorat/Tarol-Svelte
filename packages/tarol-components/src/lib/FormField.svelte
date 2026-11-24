<!--
  @component
  One field of a `changeForm(...)`, bound by its backend field path (`reserve`, `lines[1].quantity`). The error shown is
  the client rule's or the server's code, as a message from the catalogue with the bounds of the client rule, or of the
  server's detail (`errorDetails`, `1..1000000`) when the field has no client rule for the code. When the form has the option `from`, a value that changes on the server while the user edits the field shows a polite notice with "Use the new
  value" / "Keep mine"; the input and the focus stay as they are.
-->
<script lang="ts">
  import { Button, Checkbox, getMessages, NumberField, TextField } from '@clorat/tarol-design';
  import { at, type Form, type Rule } from '@clorat/tarol-svelte';
  import { setAt } from './paths.js';

  interface Props {
    /** The form from `changeForm(...)`. */
    form: Form<object, unknown>;
    /** The backend field path. */
    path: string;
    /** The visible label (the app's own text). */
    label: string;
    /** `text` (default), `number`, `email`, `password`, `tel`, `url`, or `checkbox` (a boolean member, e.g. a consent). */
    type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'url' | 'checkbox' | undefined;
    /** The field's rules: their bounds fill the message (`Enter between {min} and {max} characters.`). */
    rules?: readonly Rule[] | undefined;
    /** Help text. */
    hint?: string | undefined;
    /** Marks the field as required. */
    required?: boolean | undefined;
  }

  let { form, path, label, type = 'text', rules = [], hint, required = false }: Props = $props();
  const t = getMessages();
  const code = $derived(form.error(path));
  const rule = $derived(rules.find((r) => r.code === code));
  // the backend writes a generated rule's bounds as `<min>..<max>` (a paging check writes words: no bounds then)
  const bounds = $derived(/^(-?[\d.]+)\.\.(-?[\d.]+)$/.exec(form.detail(path) ?? ''));
  const error = $derived(
    code === undefined
      ? undefined
      : rule
        ? t(code, { min: rule.min, max: rule.max })
        : t(code, { min: bounds?.[1], max: bounds?.[2] }),
  );
  // the field binds a text or a number input, so the server's value is a string, a number or null
  const conflict = $derived(form.conflict(path));
</script>

<!-- one block: the form's gap stays between fields, and the empty live region below the field takes no room -->
<div class="t-form-field">
  {#if type === 'checkbox'}
    <!-- a box changes at once: it is touched on the change, not on the blur (TS-4) -->
    <Checkbox
      {label}
      {hint}
      {error}
      {required}
      bind:checked={
        () => at(form.values, path) === true,
        (v) => {
          setAt(form.values, path, v);
          form.touch(path);
        }
      }
    />
  {:else if type === 'number'}
    <NumberField
      {label}
      {hint}
      {error}
      {required}
      bind:value={
        () => at(form.values, path) as number | null,
        (v) => {
          setAt(form.values, path, v);
          // once a field shows an error it is checked while typing, so the error is gone before the blur: otherwise the
          // blur of a click on submit removes the message, the button moves up and the click is lost
          if (code !== undefined) form.touch(path);
        }
      }
      onblur={() => {
        form.touch(path);
      }}
    />
  {:else}
    <TextField
      {label}
      {hint}
      {error}
      {required}
      {type}
      bind:value={
        () => (at(form.values, path) as string | null) ?? '',
        (v) => {
          setAt(form.values, path, v);
          // once a field shows an error it is checked while typing, so the error is gone before the blur: otherwise the
          // blur of a click on submit removes the message, the button moves up and the click is lost
          if (code !== undefined) form.touch(path);
        }
      }
      onblur={() => {
        form.touch(path);
      }}
    />
  {/if}
  <!-- the value changed on the server while the user edits it (SV-26): keep the input, say so politely, let them choose -->
  <div role="status" class="t-field-changed">
    {#if conflict}
      <span>{t('ui.changed', { theirs: (conflict.theirs ?? '') as string | number })}</span>
      <Button
        variant="secondary"
        onclick={() => {
          form.resolve(path, 'theirs');
        }}
      >
        {t('ui.takeTheirs')}
      </Button>
      <Button
        variant="secondary"
        onclick={() => {
          form.resolve(path, 'mine');
        }}
      >
        {t('ui.keepMine')}
      </Button>
    {/if}
  </div>
</div>

<style>
  /* one line of small text with the two buttons inline: the content below moves by as little as possible (CLS) */
  .t-field-changed {
    font-size: var(--t-text-sm);
  }

  .t-field-changed :global(button) {
    margin-inline-start: var(--t-space-2);
  }
</style>
