<script>import { createDialog, melt } from '@melt-ui/svelte'; const { elements: { trigger, overlay, content, title, description, close, portalled }, states: { open } } = createDialog();</script>
<button use:melt={$trigger}>Open</button>
{#if $open}<div use:melt={$portalled}><div use:melt={$overlay}></div><div use:melt={$content}><h2 use:melt={$title}>T</h2><p use:melt={$description}>D</p><button use:melt={$close}>x</button></div></div>{/if}
