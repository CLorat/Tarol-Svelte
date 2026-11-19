<script lang="ts">
  let { code }: { code: string } = $props();
</script>

<!-- wrapped, never scrolled: a scrolling region would have to be focusable (axe scrollable-region-focusable) -->
<pre><code>{code.trim()}</code></pre>

<style>
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding: var(--t-space-3);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg-subtle);
    font-family: var(--t-font-mono);
    font-size: var(--t-text-xs);
  }
</style>
