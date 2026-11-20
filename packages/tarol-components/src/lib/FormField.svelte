<!--
  @component
  One field of a `changeForm(...)`, bound by its backend field path (`reserve`, `lines[1].quantity`). The error shown is
  the client rule's or the server's code, as a message from the catalogue with the bounds of the client rule, or of the
  server's detail (`errorDetails`, `1..1000000`) when the field has no client rule for the code.
-->
<script lang="ts">
  import { getMessages, NumberField, TextField } from '@clorat/tarol-design';
  import { at, type Form, type Rule } from '@clorat/tarol-svelte';
  import { setAt } from './paths.js';

  interface Props {
    /** The form from `changeForm(...)`. */
    form: Form<object, unknown>;
    /** The backend field path. */
    path: string;
    /** The visible label (the app's own text). */
    label: string;
    /** `text` (default), `number`, `email`, `password`, `tel`, `url`. */
    type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'url' | undefined;
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
</script>

{#if type === 'number'}
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
