---
name: tarol-design
description: >-
  Use when styling or building UI with the tarol-svelte design system: tokens and themes (dark mode, density), buttons,
  form fields with errors, modal dialogs, toasts, loading skeletons, or German/English texts. Covers tokens.css,
  ThemeRoot, Button, Field, TextField, NumberField, Dialog, getToasts, Skeleton, Spinner, en, de and getMessages from
  @clorat/tarol-design. Do not add Tailwind or a global CSS reset, hand-write focus traps, or hard-code user-visible text.
---

# tarol-design

## Rules

1. Import `@clorat/tarol-design/tokens.css` once and wrap the app in `<ThemeRoot>`. Tokens and texts apply only inside it.
2. Theme by overriding custom properties on `.t-root` (or a wrapper inside it): `--t-color-accent`, `--t-radius-2`,
   `--t-font-sans` … Never edit component CSS or use `!important`. `theme="dark"`/`"light"`/`"auto"`,
   `density="compact"`.
3. Texts: components never contain literal text. Pass the app's own labels as props; built-in texts and backend codes go
   through `getMessages()` (`t('Range', { min: 1, max: 10 })`). German: `<ThemeRoot locale="de" messages={de}>`; app
   catalogues first: `messages={[myDe, de]}`.
4. Fields: `TextField`/`NumberField` take `label`, `hint`, `error` (already translated) and `required`; label, hint and
   error are wired with `aria-describedby`/`aria-invalid`. `NumberField` binds `number | null`.
5. Dialogs: `<Dialog bind:open title>` on the native `<dialog>`: focus moves in, Escape and backdrop close it (unless
   `dismissible={false}`), focus returns to the opener. Put actions in the `footer` snippet.
6. Toasts: `getToasts().show(text, { kind: 'success' | 'info' | 'error' })` inside a ThemeRoot; errors stay until dismissed
   and are announced assertively.
7. Buttons are `type="button"` unless you say `type="submit"`; `loading` disables and sets `aria-busy`.

## Example

```svelte
<script lang="ts">
  import { Button, Dialog, getMessages, getToasts } from '@clorat/tarol-design';
  let { onConfirm }: { onConfirm: () => Promise<boolean> } = $props();
  const t = getMessages();
  const toasts = getToasts();
  let open = $state(false);
  let busy = $state(false);
</script>

<Button variant="danger" onclick={() => (open = true)}>{t('app.delete')}</Button>
<Dialog bind:open title={t('app.deleteTitle')}>
  <p>{t('app.deleteBody')}</p>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (open = false)}>{t('app.keep')}</Button>
    <Button variant="danger" loading={busy} onclick={async () => {
      busy = true;
      if (await onConfirm()) { open = false; toasts.show(t('app.deleted'), { kind: 'success' }); }
      busy = false;
    }}>{t('app.delete')}</Button>
  {/snippet}
</Dialog>
```

## Common mistakes

| Mistake | What happens |
|---|---|
| no `ThemeRoot` | tokens do not apply; `getToasts()` throws `tarol-design: getToasts() needs a ThemeRoot above the component` |
| `<div role="dialog">` with a hand-written focus trap | use `Dialog`; the native element makes the page inert |
| `<ThemeRoot locale="de">` without `messages={de}` | the `lang` attribute is German but the built-in texts stay English |
| literal text in a shipped component | `eng/check-text.mjs` fails CI (philosophy P7) |
| Tailwind's preflight in the app | resets elements globally; tarol-design needs none |

## Notes

* Only the catalogues you pass are bundled; `en` is the default.
* `prefers-reduced-motion` sets the duration tokens to 0. All token pairs meet WCAG 2.2 AA contrast in both themes.
