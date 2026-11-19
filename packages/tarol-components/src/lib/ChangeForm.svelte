<!--
  @component
  A `<form>` around a `changeForm(...)`: Enter submits, the submit button shows the pending state, and a violation that
  belongs to no field (403, 409, malformed body) is shown and announced above the button.
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
  {#if message}<p class="t-form-error" role="alert">{message}</p>{/if}
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
    margin: 0;
    color: var(--t-color-danger);
    font-size: var(--t-text-sm);
  }
  .t-form-actions {
    display: flex;
    justify-content: end;
    gap: var(--t-space-2);
  }
</style>
