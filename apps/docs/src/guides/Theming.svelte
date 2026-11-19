<script lang="ts">
  import Code from './Code.svelte';
</script>

<h1>Theming</h1>
<p>Plain CSS custom properties, scoped to <code>ThemeRoot</code>; nothing global, no reset.</p>
<Code
  code={`<ThemeRoot theme="auto" density="compact" locale="de" messages={[myDe, de]}>…</ThemeRoot>

.brand :global(.t-root) { --t-color-accent: #0f766e; --t-radius-2: 0; }`}
/>
<p>
  Every text and UI token pair meets WCAG 2.2 AA in both themes (checked in CI). See the <a href="#/tokens">tokens</a>.
  The header of this app switches theme and density.
</p>
