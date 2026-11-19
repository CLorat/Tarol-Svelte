<script lang="ts">
  import css from '@clorat/tarol-design/tokens.css?raw';

  // the tokens are read from the shipped CSS itself, so the page cannot drift from it
  // the light defaults: every `:where(.t-root)` block (scale, then colours); themes and density override them
  const blocks = [...css.matchAll(/:where\(\.t-root\)\{([^}]*)\}/g)].map((m) => m[1] ?? '').join(';');
  const tokens = [
    ...new Map([...blocks.matchAll(/(--t-[\w-]+):([^;]+)/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()])),
  ].map(([name, value]) => ({ name, value }));
</script>

<h1>Tokens</h1>
<p>
  CSS custom properties on <code>.t-root</code> (<code>ThemeRoot</code>). Override them on a wrapper to theme an app;
  the dark theme and the compact density change them, nothing else.
</p>
<table>
  <caption class="hidden">Design tokens</caption>
  <thead><tr><th scope="col">Token</th><th scope="col">Light value</th><th scope="col">Sample</th></tr></thead>
  <tbody>
    {#each tokens as t (t.name)}
      <tr>
        <td><code>{t.name}</code></td>
        <td><code>{t.value}</code></td>
        <td>
          {#if t.name.startsWith('--t-color')}<span class="swatch" style:background="var({t.name})"></span>{/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  table {
    border-collapse: collapse;
    font-size: var(--t-text-sm);
  }
  td,
  th {
    padding: var(--t-space-1) var(--t-space-2);
    border-bottom: 1px solid var(--t-color-border);
    text-align: start;
  }
  .swatch {
    display: inline-block;
    width: 2rem;
    height: 1rem;
    border: 1px solid var(--t-color-border-strong);
    border-radius: var(--t-radius-1);
  }
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
