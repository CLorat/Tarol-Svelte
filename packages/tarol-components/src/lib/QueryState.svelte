<!--
  @component
  Loading, empty, error and stale states around a query or list from `@clorat/tarol-svelte`. While the first read runs it
  shows skeletons of a fixed height (no layout shift); an error shows the code's message and a retry; the content stays
  visible while revalidating.
-->
<script module lang="ts">
  import type { Violation } from '@clorat/tarol-client';

  /** What QueryState reads: a `query(...)` or `list(...)` result. */
  export interface QueryStateSource {
    /** A read is running. */
    readonly loading: boolean;
    /** The last read's failure, if any. */
    readonly violation: Violation | undefined;
    /** The failed request's id, shown to quote in a report. */
    readonly requestId?: string | undefined;
    /** A list answered before catching up with this client's own write (`Tarol-Stale`). */
    readonly stale?: boolean;
    /** A query's value. */
    readonly value?: unknown;
    /** A list's rows. */
    readonly items?: readonly unknown[];
    /** Reads again (the retry button). */
    refresh(): Promise<void>;
  }
</script>

<script lang="ts">
  import { Button, getMessages, Skeleton } from '@clorat/tarol-design';
  import type { Snippet } from 'svelte';

  interface Props {
    /** The query or list. */
    state: QueryStateSource;
    /** The content, rendered once there is a value (or at least one item). */
    children: Snippet;
    /** Replaces the default empty text. */
    empty?: Snippet | undefined;
    /** Replaces the default skeletons. */
    loading?: Snippet | undefined;
    /** Skeleton rows while the first read runs. Default 3. */
    rows?: number | undefined;
  }

  let { state, children, empty, loading, rows = 3 }: Props = $props();
  const t = getMessages();
  const has = $derived(state.items === undefined ? state.value !== undefined : state.items.length > 0);
  const known = $derived(has || (!state.loading && state.violation === undefined));
</script>

<div class="t-query" aria-busy={state.loading || undefined}>
  {#if state.violation}
    <div class="t-query-error" role="alert">
      <p>
        {t(state.violation.kind === 'error' ? state.violation.code : 'error.generic')}
        {#if state.requestId}<span class="t-reference">{t('ui.reference', { id: state.requestId })}</span>{/if}
      </p>
      <Button variant="secondary" onclick={() => state.refresh()}>{t('ui.retry')}</Button>
    </div>
  {/if}
  {#if has}
    {#if state.stale}<p class="t-query-stale" role="status">{t('ui.stale')}</p>{/if}
    {@render children()}
  {:else if !known}
    {#if loading}{@render loading()}{:else}
      <div class="t-query-loading">
        <span class="t-visually-hidden" role="status">{t('ui.loading')}</span>
        {#each { length: rows }, i (i)}<Skeleton height="2.5rem" />{/each}
      </div>
    {/if}
  {:else if !state.violation}
    {#if empty}{@render empty()}{:else}<p class="t-query-empty">{t('ui.empty')}</p>{/if}
  {/if}
</div>

<style>
  .t-query-loading {
    display: grid;
    gap: var(--t-space-2);
  }
  .t-query-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--t-space-4);
    padding: var(--t-space-3) var(--t-space-4);
    border: 1px solid var(--t-color-danger);
    border-radius: var(--t-radius-2);
  }
  .t-query-error p,
  .t-query-empty,
  .t-query-stale {
    margin: 0;
  }
  .t-query-empty,
  .t-query-stale {
    color: var(--t-color-fg-muted);
    font-size: var(--t-text-sm);
  }
  .t-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* the request id a user can quote when reporting the error */
  .t-reference {
    display: block;
    color: var(--t-color-fg-muted);
    font-size: var(--t-text-xs);
  }
</style>
