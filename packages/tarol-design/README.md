# @clorat/tarol-design

The design system of [tarol-svelte](https://github.com/CLorat/Tarol-Svelte): CSS custom-property tokens, light and dark
themes, two densities, a de/en message catalogue, and accessible Svelte 5 primitives on native elements. It does not
depend on any Tarol package, and nothing applies outside `ThemeRoot` (no global reset).

```svelte
<script lang="ts">
  import '@clorat/tarol-design/tokens.css';
  import { Button, Dialog, TextField, ThemeRoot, de } from '@clorat/tarol-design';
  let open = $state(false);
  let title = $state('');
</script>

<ThemeRoot locale="de" messages={de} density="compact">
  <TextField label="Titel" bind:value={title} required />
  <Button onclick={() => (open = true)}>Löschen</Button>
  <Dialog bind:open title="Auktion löschen">…</Dialog>
</ThemeRoot>
```

| Part | What |
|---|---|
| `tokens.css` | `--t-color-*`, `--t-space-*` (× density), `--t-radius-*`, `--t-text-*`, `--t-shadow-*`, `--t-duration-*` (0 under reduced motion and with `motion="reduce"`); scoped to `.t-root` |
| `ThemeRoot` | `theme` (`auto`/`light`/`dark`), `density`, `motion` (`auto`/`reduce`: duration tokens 0), `locale`, `messages` (catalogues, tried in order), the toast region |
| Primitives | `Button`, `Field`, `TextField`, `NumberField`, `DateField` (native date input, ISO value), `Checkbox` (a consent: box, label, hint, error), `Select` (native select with a placeholder), `RadioGroup` (fieldset of radio buttons), `Dialog` (native `<dialog>`), `Toaster`/`getToasts`, `Spinner`, `Skeleton`, `VisuallyHidden` |
| Widgets (WAI-ARIA APG, on `popover`) | `Combobox` (list autocomplete; `filter={false}` + `onquery` for a server search), `MenuButton` (actions), `Tabs` (automatic activation) |
| Messages | `en` (default), `de`; `getMessages()` → `t(id, params)`; backend codes (`Range`, `Auth.Forbidden` …) are message ids |

Theme an app by overriding tokens: `.t-root { --t-color-accent: #0f766e; }`. Every text and UI token pair meets WCAG 2.2
AA contrast in both themes (checked in CI).

Size (gzip, compiled with their CSS): tokens.css 0.93 KB, Dialog 1.76 KB, Button 1.26 KB, TextField 1.74 KB, DateField
1.79 KB, Combobox 2.99 KB, MenuButton 1.7 KB, Tabs 1.2 KB, ThemeRoot with Toaster and the English catalogue 2.58 KB.

Licence: AGPL-3.0-only, or a commercial licence from the copyright holder.
