<script lang="ts">
  import type { CataloguePage } from './pages.js';
  import catalogue from './props.json';

  let { page }: { page: CataloguePage } = $props();
  const info = $derived(catalogue[page.name as keyof typeof catalogue]);
  const Example = $derived(page.example);
</script>

<article class="doc">
  <h1>{page.name}</h1>
  <p class="package"><code>import &#123; {page.name} &#125; from '{info.package}';</code></p>
  <p>{info.doc}</p>

  <h2>Example</h2>
  <div class="example" data-testid="example"><Example /></div>
  <details>
    <summary>Source</summary>
    <pre><code>{page.source.trim()}</code></pre>
  </details>

  <h2>Props</h2>
  {#if info.props.length === 0}
    <p>None.</p>
  {:else}
    <div class="scroll">
      <table>
        <caption class="hidden">Props of {page.name}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th><th scope="col">Type</th><th scope="col">Default</th><th scope="col">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {#each info.props as p (p.name)}
            <tr>
              <th scope="row">
                <code>{p.name}{p.optional ? '?' : ''}</code>{#if p.bindable}
                  <small>(bindable)</small>{/if}
              </th>
              <td><code>{p.type}</code></td>
              <td>
                {#if p.default !== null}<code>{p.default}</code>{/if}
              </td>
              <td>{p.doc}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if info.extends}<p>Also every attribute of <code>{info.extends}</code>.</p>{/if}
  {/if}

  {#if page.keys.length > 0}
    <h2>Keyboard</h2>
    <table>
      <caption class="hidden">Keyboard support of {page.name}</caption>
      <thead><tr><th scope="col">Key</th><th scope="col">Action</th></tr></thead>
      <tbody>
        {#each page.keys as [key, action] (key)}<tr><td><kbd>{key}</kbd></td><td>{action}</td></tr>{/each}
      </tbody>
    </table>
  {/if}
</article>

<style>
  .doc {
    max-width: 60rem;
  }
  .example {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--t-space-3);
    flex-direction: column;
    padding: var(--t-space-4);
    border: 1px solid var(--t-color-border);
    border-radius: var(--t-radius-3);
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding: var(--t-space-3);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg-subtle);
    font-family: var(--t-font-mono);
    font-size: var(--t-text-xs);
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: var(--t-text-sm);
  }
  th,
  td {
    padding: var(--t-space-2);
    border-bottom: 1px solid var(--t-color-border);
    text-align: start;
    vertical-align: top;
  }
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .package {
    color: var(--t-color-fg-muted);
  }
</style>
