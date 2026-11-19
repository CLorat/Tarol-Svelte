<!--
  @component
  A table over a keyset `list(...)`: column headers that switch the backend sort, a "load more" button for the next page,
  and virtual scrolling above `virtualizeAbove` rows (only the visible rows are in the DOM). Cells are a snippet, so any
  formatting or component fits. It is a WAI-ARIA data grid: one tab stop; arrow keys move between cells, Home/End to the
  row's ends, Ctrl+Home/End to the first and last cell, Page Up/Down by 10 rows (scrolling virtual rows into the DOM). A
  cell with one widget (a link, a button, the sort button) focuses that widget instead of the cell.
-->
<script module lang="ts">
  import type { List } from '@clorat/tarol-svelte';
  import type { Snippet } from 'svelte';
  import type { Column } from './column.js';

  /** The props of DataTable. */
  export interface DataTableProps<T> {
    /** The list from `list(...)`. */
    list: List<T>;
    /** The columns, in order. */
    columns: readonly Column[];
    /** Renders one cell. */
    cell: Snippet<[T, Column]>;
    /** A stable key per row (usually the id). */
    rowKey: (row: T) => string;
    /** The table's accessible name (the app's own text). */
    caption: string;
    /** The backend sort value in use (bindable): the list's request should read it. */
    sort?: string | undefined;
    /** Render only visible rows when there are more than this. Default 200 (docs/migration/design.md). */
    virtualizeAbove?: number | undefined;
    /** The fixed row height in px used for virtual scrolling. Default 40. */
    rowHeight?: number | undefined;
    /** The height of the scroll area when virtualized. Default `70vh`. */
    maxHeight?: string | undefined;
  }

  const focusable = 'a[href], button, input, select, textarea, [tabindex]:not(td):not(th)';
</script>

<script lang="ts" generics="T">
  import { Button, getMessages } from '@clorat/tarol-design';
  import { tick } from 'svelte';

  let {
    list,
    columns,
    cell,
    rowKey,
    caption,
    sort = $bindable(),
    virtualizeAbove = 200,
    rowHeight = 40,
    maxHeight = '70vh',
  }: DataTableProps<T> = $props();

  const t = getMessages();
  let scrollTop = $state(0);
  let viewport = $state(0);
  const virtual = $derived(list.items.length > virtualizeAbove);
  const overscan = 10;
  const first = $derived(virtual ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0);
  const last = $derived(
    virtual ? Math.min(list.items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan) : list.items.length,
  );
  const visible = $derived(list.items.slice(first, last));

  // the active cell: row 0 is the header, rows 1… the data rows (aria-rowindex - 1)
  let active = $state({ row: 0, col: 0 });
  let table = $state<HTMLTableElement>();
  let scroller = $state<HTMLDivElement>();

  const cellAt = (row: number, col: number): HTMLElement | undefined =>
    table?.querySelector<HTMLTableRowElement>(`tr[aria-rowindex="${String(row + 1)}"]`)?.cells[col];

  // one tab stop: only the active cell (or its widget) is in the tab order
  $effect(() => {
    const { row, col } = active;
    // reading the rendered rows and columns reruns this when they change
    if (!table || visible.length + columns.length === 0) return;
    for (const cell of table.querySelectorAll<HTMLElement>('th, td')) {
      const on = cell === cellAt(row, col);
      const widgets = cell.querySelectorAll<HTMLElement>(focusable);
      for (const w of widgets) w.tabIndex = on ? 0 : -1;
      cell.tabIndex = on && widgets.length === 0 ? 0 : -1;
    }
  });

  async function move(row: number, col: number): Promise<void> {
    const rows = list.items.length;
    active = { row: Math.max(0, Math.min(rows, row)), col: Math.max(0, Math.min(columns.length - 1, col)) };
    if (virtual && scroller && active.row > 0) {
      // bring the row into the rendered window before focusing it
      const top = (active.row - 1) * rowHeight;
      const header = rowHeight;
      if (top < scroller.scrollTop) scroller.scrollTop = top;
      else if (top + rowHeight > scroller.scrollTop + viewport - header)
        scroller.scrollTop = top + 2 * rowHeight - viewport;
      scrollTop = scroller.scrollTop;
    }
    await tick();
    const cell = cellAt(active.row, active.col);
    (cell?.querySelector<HTMLElement>(focusable) ?? cell)?.focus();
  }

  function keydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    // keys typed into a field inside a cell belong to the field
    if (target.matches('input, select, textarea')) return;
    const cell = target.closest('td, th');
    const row = Number(cell?.parentElement?.getAttribute('aria-rowindex') ?? 1) - 1;
    const col = (cell as HTMLTableCellElement | null)?.cellIndex ?? 0;
    const end = columns.length - 1;
    const map: Record<string, [number, number] | undefined> = {
      ArrowDown: [row + 1, col],
      ArrowUp: [row - 1, col],
      ArrowRight: [row, col + 1],
      ArrowLeft: [row, col - 1],
      Home: e.ctrlKey ? [0, 0] : [row, 0],
      End: e.ctrlKey ? [list.items.length, end] : [row, end],
      PageDown: [row + 10, col],
      PageUp: [row - 10, col],
    };
    const to = map[e.key];
    if (!to) return;
    e.preventDefault();
    void move(to[0], to[1]);
  }
</script>

<div
  bind:this={scroller}
  class="t-table-scroll"
  style:max-height={virtual ? maxHeight : undefined}
  style:overflow-y={virtual ? 'auto' : undefined}
  bind:clientHeight={viewport}
  onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
>
  <table
    bind:this={table}
    class="t-table"
    role="grid"
    aria-rowcount={list.items.length + 1}
    aria-busy={list.loading || undefined}
    onkeydown={keydown}
    onfocusin={(e) => {
      const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('td, th');
      const row = Number(cell?.parentElement?.getAttribute('aria-rowindex') ?? 0) - 1;
      if (cell && row >= 0) active = { row, col: cell.cellIndex };
    }}
  >
    <caption class="t-visually-hidden">{caption}</caption>
    <thead>
      <tr aria-rowindex="1">
        {#each columns as c (c.key)}
          <th
            scope="col"
            style:width={c.width}
            style:text-align={c.align === 'end' ? 'end' : undefined}
            aria-sort={c.sort && sort === c.sort.value ? c.sort.direction : undefined}
          >
            {#if c.sort}
              {@const s = c.sort}
              <button type="button" class="t-sort" aria-pressed={sort === s.value} onclick={() => (sort = s.value)}>
                {c.header}
                {#if sort === s.value}
                  <span class="t-visually-hidden">
                    ({t(s.direction === 'descending' ? 'ui.sortDescending' : 'ui.sortAscending')})
                  </span>
                  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                    <path
                      d={s.direction === 'descending' ? 'M1 3l4 4 4-4' : 'M1 7l4-4 4 4'}
                      stroke="currentColor"
                      fill="none"
                      stroke-width="1.5"
                    />
                  </svg>
                {/if}
              </button>
            {:else}
              {c.header}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if first > 0}<tr aria-hidden="true" style:height="{first * rowHeight}px"></tr>{/if}
      {#each visible as row, i (rowKey(row))}
        <tr aria-rowindex={first + i + 2} style:height={virtual ? `${String(rowHeight)}px` : undefined}>
          {#each columns as c (c.key)}
            <td style:text-align={c.align === 'end' ? 'end' : undefined}>{@render cell(row, c)}</td>
          {/each}
        </tr>
      {/each}
      {#if last < list.items.length}<tr aria-hidden="true" style:height="{(list.items.length - last) * rowHeight}px"
        ></tr>{/if}
    </tbody>
  </table>
</div>
{#if list.hasMore}
  <div class="t-table-more">
    <Button variant="secondary" loading={list.loading} onclick={() => list.more()}>{t('ui.more')}</Button>
  </div>
{/if}

<style>
  .t-table-scroll {
    overflow-x: auto;
  }
  .t-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--t-text-sm);
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: var(--t-space-2) var(--t-space-3);
    border-bottom: 1px solid var(--t-color-border);
    text-align: start;
    white-space: nowrap;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--t-color-bg);
    color: var(--t-color-fg-muted);
    font-weight: var(--t-weight-medium);
  }
  .t-sort {
    display: inline-flex;
    align-items: center;
    gap: var(--t-space-1);
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .t-sort[aria-pressed='true'] {
    color: var(--t-color-fg);
  }
  td:focus-visible,
  th:focus-visible {
    outline: 2px solid var(--t-color-focus);
    outline-offset: -2px;
  }
  .t-table-more {
    display: flex;
    justify-content: center;
    padding: var(--t-space-3);
  }
  .t-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
