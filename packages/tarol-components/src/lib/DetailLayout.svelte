<!--
  @component
  The page of one aggregate over a `query(...)` of its view: a heading from the value, optional facts (`meta`), actions
  (e.g. a `MenuButton`) and an aside, with loading, error and stale states from `QueryState`. The heading is the page's
  `h1`; while the first read runs a skeleton of the same height holds its place (no layout shift).
-->
<script module lang="ts">
  import type { Query } from '@clorat/tarol-svelte';
  import type { Snippet } from 'svelte';

  /** The props of DetailLayout. */
  export interface DetailLayoutProps<T> {
    /** The view, from `query(...)`. */
    query: Query<T>;
    /** The heading of the loaded value (already translated where needed). */
    title: (value: T) => string;
    /** The main content. */
    children: Snippet<[T]>;
    /** Short facts under the heading (status, dates). */
    meta?: Snippet<[T]> | undefined;
    /** Actions next to the heading. */
    actions?: Snippet<[T]> | undefined;
    /** A side column (related lists, history); below the content on narrow screens. */
    aside?: Snippet<[T]> | undefined;
  }
</script>

<script lang="ts" generics="T">
  import { Skeleton } from '@clorat/tarol-design';
  import QueryState from './QueryState.svelte';

  let { query, title, children, meta, actions, aside }: DetailLayoutProps<T> = $props();
</script>

<article class="t-detail">
  <QueryState state={query} rows={4}>
    {#if query.value !== undefined}
      {@const value = query.value}
      <header class="t-detail-header">
        <div class="t-detail-heading">
          <h1>{title(value)}</h1>
          {#if meta}<div class="t-detail-meta">{@render meta(value)}</div>{/if}
        </div>
        {#if actions}<div class="t-detail-actions">{@render actions(value)}</div>{/if}
      </header>
      <div class="t-detail-body" class:t-detail-with-aside={aside !== undefined}>
        <div class="t-detail-main">{@render children(value)}</div>
        {#if aside}<aside class="t-detail-aside">{@render aside(value)}</aside>{/if}
      </div>
    {/if}
    {#snippet loading()}
      <Skeleton height="2.25rem" width="40%" />
      <Skeleton height="12rem" />
    {/snippet}
  </QueryState>
</article>

<style>
  .t-detail {
    display: flex;
    flex-direction: column;
    gap: var(--t-space-4);
  }
  .t-detail-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--t-space-3);
    margin-bottom: var(--t-space-4);
  }
  h1 {
    margin: 0;
    font-size: var(--t-text-xl);
    line-height: 1.25;
  }
  .t-detail-meta {
    margin-top: var(--t-space-1);
    color: var(--t-color-fg-muted);
    font-size: var(--t-text-sm);
  }
  .t-detail-actions {
    display: flex;
    gap: var(--t-space-2);
  }
  .t-detail-with-aside {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(14rem, 20rem);
    gap: var(--t-space-6);
  }
  @media (max-width: 48rem) {
    .t-detail-with-aside {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
