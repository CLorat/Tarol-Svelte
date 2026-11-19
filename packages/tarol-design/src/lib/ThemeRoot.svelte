<!--
  @component
  The root of the design system: sets `.t-root` (tokens apply only inside it), the theme and density, the message
  catalogue for its subtree, and the notification region. Nothing outside it is touched.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { en } from './en.js';
  import { setMessages, translator, type Catalogue } from './messages.js';
  import { createToasts, setToasts } from './toasts.svelte.js';
  import Toaster from './Toaster.svelte';

  interface Props {
    /** `light`, `dark`, or `auto` (follows `prefers-color-scheme`). Default `auto`. */
    theme?: 'light' | 'dark' | 'auto' | undefined;
    /** `comfortable` (default) or `compact`. */
    density?: 'comfortable' | 'compact' | undefined;
    /** The language of the subtree (`lang` attribute), e.g. `de`. Default `en`. */
    locale?: string | undefined;
    /**
     * The catalogues, tried in order: the app's own first, then a built-in one (`en`, the default, or `de` from this
     * package). Only the catalogues an app passes are bundled.
     */
    messages?: Catalogue | readonly Catalogue[] | undefined;
    children: Snippet;
  }

  let { theme = 'auto', density = 'comfortable', locale = 'en', messages = en, children }: Props = $props();

  const isList = (m: Catalogue | readonly Catalogue[]): m is readonly Catalogue[] => Array.isArray(m);
  const t = $derived(translator(...(isList(messages) ? messages : [messages])));
  // the context holds a stable function that always uses the current props
  setMessages((id, params) => t(id, params));
  setToasts(createToasts());
</script>

<div
  class="t-root"
  data-theme={theme === 'auto' ? undefined : theme}
  data-density={density === 'compact' ? 'compact' : undefined}
  lang={locale}
>
  {@render children()}
  <Toaster />
</div>
