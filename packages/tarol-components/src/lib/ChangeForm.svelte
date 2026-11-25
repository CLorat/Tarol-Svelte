<!--
  @component
  A `<form>` around a `changeForm(...)`: Enter submits, the submit button shows the pending state, and a violation that
  belongs to no field (403, 409, malformed body) is shown and announced above the button, with the request's reference
  (`Tarol-Request-Id`) for a user to quote; the reasons of a refusal (`reasons`) are listed under its message.
-->
<script lang="ts">
  import { Button, getMessages } from '@clorat/tarol-design';
  import type { Form } from '@clorat/tarol-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    /** The form from `changeForm(...)`. */
    form: Form<object, unknown>;
    /** The submit button's text (the app's own). */
    submitLabel: string;
    /** The fields. */
    children: Snippet;
    /** More buttons next to submit (e.g. cancel). */
    actions?: Snippet | undefined;
  }

  let { form, submitLabel, children, actions }: Props = $props();
  const t = getMessages();
  const message = $derived.by(() => {
    const v = form.formError;
    if (!v) return undefined;
    return v.kind === 'error' ? t(v.code) : t(Object.values(v.errors)[0]?.[0] ?? 'error.generic');
  });
  // the codes of the reasons of a refusal (Tarol-Net `reasons`), each a message of its own
  const reasons = $derived(form.formError?.kind === 'error' ? (form.formError.reasons ?? []) : []);
</script>

<form
  class="t-change-form"
  novalidate
  onsubmit={(e) => {
    e.preventDefault();
    void form.submit();
  }}
>
  {@render children()}
  {#if message}<div class="t-form-error" role="alert">
      <p>{message}</p>
      {#if reasons.length > 0}<ul>
          {#each reasons as r, i (i)}<li>{t(r)}</li>{/each}
        </ul>{/if}
      {#if form.requestId}<span class="t-reference">{t('ui.reference', { id: form.requestId })}</span>{/if}
    </div>{/if}
  <div class="t-form-actions">
    {@render actions?.()}
    <Button type="submit" loading={form.pending}>{submitLabel}</Button>
  </div>
</form>

<style>
  .t-change-form {
    display: flex;
    flex-direction: column;
    gap: var(--t-space-4);
  }
  .t-form-error {
    color: var(--t-color-danger);
    font-size: var(--t-text-sm);
  }
  .t-form-error p,
  .t-form-error ul {
    margin: 0;
  }
  .t-form-error ul {
    padding-inline-start: var(--t-space-4);
  }
  .t-form-actions {
    display: flex;
    justify-content: end;
    gap: var(--t-space-2);
  }
  /* the request id a user can quote when reporting the error */
  .t-reference {
    display: block;
    color: var(--t-color-fg-muted);
    font-size: var(--t-text-xs);
  }
</style>
