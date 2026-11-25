---
name: tarol-design
description: >-
  Use when styling or building UI with the tarol-svelte design system: tokens and themes (dark mode, density), buttons,
  form fields with errors, dates, comboboxes, menus, tabs, modal dialogs, toasts, loading skeletons, or German/English
  texts. Covers tokens.css, ThemeRoot, Button, Field, TextField, NumberField, DateField, Combobox, MenuButton, Tabs,
  Dialog, getToasts, Skeleton, Spinner, en, de and getMessages from
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
   catalogues first: `messages={[myDe, de]}`. A backend code `X.Y` that no catalogue has falls back to the generic `Y`
   (`ChildDayCare.NotFound` → `NotFound`, `Plot.AlreadyExists` → `AlreadyExists`): add `X.Y` only for a better text.
   Build an app catalogue from its areas with `defineMessages(contractsDe, planningDe, …)`: it throws on a key that two
   parts give different texts. Never `{ ...contractsDe, … }`: a spread overwrites silently.
4. Fields: `TextField`/`NumberField` take `label`, `hint`, `error` (already translated) and `required`; label, hint and
   error are wired with `aria-describedby`/`aria-invalid`. `NumberField` binds `number | null`. `Checkbox` (a consent,
   a yes/no setting) takes the same props and binds `checked`; the box comes before its label. `Select` (native select,
   `placeholder`) and `RadioGroup` (a fieldset named by its legend, 44 px options) take `options={[{ value, label }]}` and
   bind the value or `null`; `TextField type="time"` binds `HH:mm`.
5. Dialogs: `<Dialog bind:open title>` on the native `<dialog>`: focus moves in, Escape and backdrop close it (unless
   `dismissible={false}`), focus returns to the opener. Put actions in the `footer` snippet.
6. Toasts: `getToasts().show(text, { kind: 'success' | 'info' | 'error' })` inside a ThemeRoot; errors stay until dismissed
   and are announced assertively.
7. Buttons are `type="button"` unless you say `type="submit"`; `loading` disables and sets `aria-busy`.
8. Choosing one value from many: `<Combobox label options={[{ value, label }]} bind:value>` (`value` is `string | null`).
   An `item(option)` snippet renders an option's content (e.g. a second line); render text, never `{@html}`.
   For a server search pass `filter={false}`, fetch in `onquery(text)` and set `options`; `loading` shows the loading
   text. Dates: `<DateField bind:value>` binds `'YYYY-MM-DD' | null` (a backend `DateOnly`).
9. Actions in a menu: `<MenuButton items={[{ id, label, disabled? }]} onselect={(id) => …}>Actions</MenuButton>`; never a
   `<select>` for actions. Sections: `<Tabs label tabs={[{ id, label }]} bind:selected>{#snippet children(id)}…{/snippet}</Tabs>`.
   Keyboard (arrows, Home/End, Escape, focus return) is built in; do not add your own key handlers.

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
| `<Combobox bind:value>` read as the typed text | `value` is the chosen option's `value` or `null`; a half-typed text is reset on blur |
| `Combobox` with server results but without `filter={false}` | the server's results are filtered again by label and may vanish |
| `<select>` or `Combobox` for actions | use `MenuButton`; a menu runs commands, a combobox chooses a value |
| `DateField` value as a `Date` | it is the ISO string `YYYY-MM-DD`; convert at the edge, never through `toISOString()` (time zones) |

## Notes

* Only the catalogues you pass are bundled; `en` is the default.
* `prefers-reduced-motion` sets the duration tokens to 0, and so does `<ThemeRoot motion="reduce">` (an in-app setting).
  All token pairs meet WCAG 2.2 AA contrast in both themes.
* Item types for an app's helpers: `MenuItem`, `TabItem`, `ComboboxOption`, `FieldControl`, `SelectProps`,
  `RadioGroupProps` (typed lint of app components: tarol-components skill).
* Test recipe: axe right after a change of `variant` (or any colour) can report `color-contrast` on a `Button` whose
  background is still in its transition. Render the test inside `<ThemeRoot motion="reduce">` (or emulate
  `reducedMotion: 'reduce'` in Playwright); never wait a fixed time before axe.
