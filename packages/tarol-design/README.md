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
| `tokens.css` | `--t-color-*`, `--t-space-*` (× density), `--t-radius-*`, `--t-text-*`, `--t-shadow-*`, `--t-duration-*` (0 under reduced motion); scoped to `.t-root` |
| `ThemeRoot` | `theme` (`auto`/`light`/`dark`), `density`, `locale`, `messages` (catalogues, tried in order), the toast region |
| Primitives | `Button`, `Field`, `TextField`, `NumberField`, `Dialog` (native `<dialog>`), `Toaster`/`getToasts`, `Spinner`, `Skeleton`, `VisuallyHidden` |
| Messages | `en` (default), `de`; `getMessages()` → `t(id, params)`; backend codes (`Range`, `Auth.Forbidden` …) are message ids |

Theme an app by overriding tokens: `.t-root { --t-color-accent: #0f766e; }`. Every text and UI token pair meets WCAG 2.2
AA contrast in both themes (checked in CI).

Size (gzip, compiled with their CSS): tokens.css 0.93 KB, Dialog 1.75 KB, Button 1.26 KB, TextField 1.73 KB, ThemeRoot
with Toaster and the English catalogue 2.57 KB.

Licence: AGPL-3.0-only, or a commercial licence from the copyright holder.
