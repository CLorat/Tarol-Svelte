<!--
  @component
  A calendar of days with entries: a month grid (entries as dots), a week (the days in rows with their entries) and a day.
  The month and week are WAI-ARIA grids with one tab stop: Arrow keys move by a day (Up/Down by a week in the month), Home
  and End go to the first and last day of the week, Ctrl+Home/End to the first and last day of the month, Page Up/Down to
  the previous and next month (Shift: year; in the week view: week). Enter or Space activates a day: `onselect`, or the
  day view when there is no `onselect`. A day's accessible name is its full date and entry count (`aria-labelledby` a
  visually hidden text); it contains the visible number, so axe's `label-content-name-mismatch` holds. Days are ISO strings
  `YYYY-MM-DD`.
-->
<script module lang="ts">
  import type { Snippet } from 'svelte';

  /** A view of the calendar. */
  export type CalendarView = 'month' | 'week' | 'day';

  /** The colour of an entry's dot (a token); the entry's text says what it is, never the colour alone. */
  export type CalendarTone = 'accent' | 'danger' | 'warning' | 'success' | 'muted';

  /** The props of Calendar. */
  export interface CalendarProps<T> {
    /** The calendar's accessible name (the app's own text, e.g. "Calendar"). */
    label: string;
    /** The focused day, `YYYY-MM-DD` (bindable). Default: today. */
    date?: string | undefined;
    /** The view (bindable). Default `month`. */
    view?: CalendarView | undefined;
    /** The views to offer; one view shows no switch. Default all three. */
    views?: readonly CalendarView[] | undefined;
    /** The entries of a day, in display order. Default: no entries. */
    entries?: ((day: string) => readonly T[]) | undefined;
    /** Renders an entry's text (in the week and day views, after its dot). */
    entry?: Snippet<[T]> | undefined;
    /** The dot colour of an entry. Default `accent`. */
    tone?: ((entry: T) => CalendarTone) | undefined;
    /** Extra content of a day in the week and day views, before its entries (e.g. "5 children expected"). */
    day?: Snippet<[string]> | undefined;
    /** Called when a day is activated (Enter, Space, click). Without it, the day view opens (when offered). */
    onselect?: ((day: string) => void) | undefined;
    /** The locale of the date texts (`Intl`), e.g. the ThemeRoot's `de`. Default `en`. */
    locale?: string | undefined;
    /** The first day of the week: 0 Sunday … 6 Saturday. Default 1 (Monday). */
    firstDay?: number | undefined;
    /** Today, `YYYY-MM-DD` (marked with `aria-current="date"`). Default: today in the browser's time zone. */
    today?: string | undefined;
    /** Dots shown in a month cell before "+n". Default 3. */
    dots?: number | undefined;
  }
</script>

<script lang="ts" generics="T">
  import { Button, getMessages } from '@clorat/tarol-design';
  import { tick } from 'svelte';
  import { addDays, addMonths, asDate, endOfMonth, localToday, monthGrid, startOfWeek, weekOf } from './days.js';

  const fallbackToday = localToday();
  let {
    label,
    today = fallbackToday,
    date = $bindable(today),
    view = $bindable('month'),
    views = ['month', 'week', 'day'],
    entries = () => [],
    entry,
    tone,
    day,
    onselect,
    locale = 'en',
    firstDay = 1,
    dots = 3,
  }: CalendarProps<T> = $props();

  const t = getMessages();
  const id = $props.id();
  let root: HTMLElement | undefined = $state();

  const format = (d: string, options: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(asDate(d));
  const long: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

  const title = $derived(
    view === 'month'
      ? format(date, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? t('ui.weekOf', {
            date: format(startOfWeek(date, firstDay), { day: 'numeric', month: 'long', year: 'numeric' }),
          })
        : format(date, long),
  );
  const weekdays = $derived(
    weekOf(date, firstDay).map((d) => ({
      short: format(d, { weekday: 'short' }),
      long: format(d, { weekday: 'long' }),
    })),
  );

  function step(n: number): void {
    date = view === 'month' ? addMonths(date, n) : addDays(date, view === 'week' ? 7 * n : n);
  }

  function activate(d: string): void {
    date = d;
    if (onselect) onselect(d);
    else if (views.includes('day')) view = 'day';
  }

  async function focusDay(d: string): Promise<void> {
    date = d;
    await tick();
    root?.querySelector<HTMLElement>(`[data-day="${d}"]`)?.focus();
  }

  function onkeydown(event: KeyboardEvent): void {
    const week = view === 'week';
    const ctrl = event.ctrlKey || event.metaKey;
    let next: string;
    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(date, -1);
        break;
      case 'ArrowRight':
        next = addDays(date, 1);
        break;
      case 'ArrowUp':
        next = addDays(date, week ? -1 : -7);
        break;
      case 'ArrowDown':
        next = addDays(date, week ? 1 : 7);
        break;
      case 'Home':
        next = ctrl && !week ? `${date.slice(0, 8)}01` : startOfWeek(date, firstDay);
        break;
      case 'End':
        next = ctrl && !week ? endOfMonth(date) : addDays(startOfWeek(date, firstDay), 6);
        break;
      case 'PageUp':
        next = week ? addDays(date, -7) : addMonths(date, event.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        next = week ? addDays(date, 7) : addMonths(date, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    void focusDay(next);
  }

  const viewLabel = (v: CalendarView): string => t(`ui.${v}`);
</script>

{#snippet name(d: string, visible: string, count: number)}
  <span aria-hidden="true">{visible}</span>
  <span class="t-calendar-sr" id={`${id}-${d}`}>
    {format(d, long)}{#if count > 0}{t('ui.entries', { count })}{/if}
  </span>
{/snippet}

{#snippet list(d: string, items: readonly T[])}
  {#if day}{@render day(d)}{/if}
  {#if items.length === 0}
    <p class="t-calendar-none">{t('ui.noEntries')}</p>
  {:else}
    <ul class="t-calendar-entries">
      {#each items as e, i (i)}
        <li>
          <span class="t-calendar-dot" data-tone={tone?.(e) ?? 'accent'} aria-hidden="true"></span>
          <span>
            {#if entry}{@render entry(e)}{:else}{String(e)}{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<div class="t-calendar" role="group" aria-label={label} bind:this={root}>
  <div class="t-calendar-bar">
    <Button
      variant="ghost"
      onclick={() => {
        step(-1);
      }}
    >
      {t('ui.previous')}
    </Button>
    <span class="t-calendar-title" id={`${id}-title`} aria-live="polite">{title}</span>
    <Button
      variant="ghost"
      onclick={() => {
        step(1);
      }}
    >
      {t('ui.next')}
    </Button>
    <Button variant="ghost" onclick={() => (date = today)}>{t('ui.today')}</Button>
    {#if views.length > 1}
      <div class="t-calendar-views" role="group" aria-label={t('ui.calendarView')}>
        {#each views as v (v)}
          <Button variant={view === v ? 'primary' : 'secondary'} aria-pressed={view === v} onclick={() => (view = v)}>
            {viewLabel(v)}
          </Button>
        {/each}
      </div>
    {/if}
  </div>

  {#if view === 'month'}
    <table class="t-calendar-month" role="grid" aria-labelledby={`${id}-title`} {onkeydown}>
      <thead>
        <tr>
          {#each weekdays as w (w.long)}<th scope="col" abbr={w.long}>{w.short}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each monthGrid(date, firstDay) as days (days[0])}
          <tr>
            {#each days as d (d)}
              {@const items = entries(d)}
              <td aria-selected={d === date} class:t-other={d.slice(0, 7) !== date.slice(0, 7)}>
                <button
                  type="button"
                  class="t-calendar-cell"
                  data-day={d}
                  tabindex={d === date ? 0 : -1}
                  aria-current={d === today ? 'date' : undefined}
                  aria-labelledby={`${id}-${d}`}
                  onclick={() => {
                    activate(d);
                  }}
                >
                  <span class="t-calendar-num">{@render name(d, format(d, { day: 'numeric' }), items.length)}</span>
                  <!-- "+n" is drawn by CSS: it is not part of the day's name, so it must not be visible text either -->
                  <span
                    class="t-calendar-dots"
                    aria-hidden="true"
                    data-more={items.length > dots ? items.length - dots : undefined}
                  >
                    {#each items.slice(0, dots) as e, i (i)}
                      <span class="t-calendar-dot" data-tone={tone?.(e) ?? 'accent'}></span>
                    {/each}
                  </span>
                </button>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if view === 'week'}
    <table class="t-calendar-week" role="grid" aria-labelledby={`${id}-title`} {onkeydown}>
      <tbody>
        {#each weekOf(date, firstDay) as d (d)}
          {@const items = entries(d)}
          <tr>
            <td aria-selected={d === date}>
              <button
                type="button"
                class="t-calendar-heading"
                data-day={d}
                tabindex={d === date ? 0 : -1}
                aria-current={d === today ? 'date' : undefined}
                aria-labelledby={`${id}-${d}`}
                onclick={() => {
                  activate(d);
                }}
              >
                {@render name(d, format(d, { weekday: 'long', day: 'numeric', month: 'long' }), items.length)}
              </button>
              {@render list(d, items)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <div class="t-calendar-day">{@render list(date, entries(date))}</div>
  {/if}
</div>

<style>
  .t-calendar {
    display: grid;
    gap: var(--t-space-3);
  }
  .t-calendar-sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .t-calendar-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--t-space-2);
  }
  .t-calendar-title {
    font-weight: var(--t-weight-medium);
    min-inline-size: 10rem;
    text-align: center;
  }
  .t-calendar-views {
    display: flex;
    gap: var(--t-space-1);
    margin-inline-start: auto;
  }
  table {
    inline-size: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th {
    padding: var(--t-space-1) 0;
    color: var(--t-color-fg-muted);
    font-size: var(--t-text-sm);
    font-weight: var(--t-weight-medium);
  }
  td {
    padding: 1px;
    vertical-align: top;
  }
  button {
    font: inherit;
    color: var(--t-color-fg);
    cursor: pointer;
  }
  .t-calendar-cell {
    display: grid;
    gap: 2px;
    justify-items: center;
    align-content: start;
    inline-size: 100%;
    min-block-size: 2.75rem;
    padding: var(--t-space-1) 0;
    border: 1px solid var(--t-color-border);
    border-radius: var(--t-radius-2);
    background: var(--t-color-bg-subtle);
  }
  .t-other .t-calendar-cell {
    color: var(--t-color-fg-muted);
    background: var(--t-color-bg);
  }
  td[aria-selected='true'] > button {
    background: var(--t-color-bg-muted);
    font-weight: var(--t-weight-medium);
  }
  [aria-current='date'] {
    border: 2px solid var(--t-color-accent);
  }
  .t-calendar-dots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px;
    min-block-size: 0.6rem;
    font-size: var(--t-text-xs);
    line-height: 0.6rem;
  }
  .t-calendar-dots[data-more]::after {
    content: '+' attr(data-more);
  }
  .t-calendar-dot {
    display: inline-block;
    flex: none;
    inline-size: 0.6rem;
    block-size: 0.6rem;
    border-radius: 50%;
    background: var(--t-color-accent);
  }
  .t-calendar-dot[data-tone='danger'] {
    background: var(--t-color-danger);
  }
  .t-calendar-dot[data-tone='warning'] {
    background: var(--t-color-warning);
  }
  .t-calendar-dot[data-tone='success'] {
    background: var(--t-color-success);
  }
  .t-calendar-dot[data-tone='muted'] {
    background: var(--t-color-fg-muted);
  }
  .t-calendar-week td {
    padding: var(--t-space-2) 0;
    border-block-end: 1px solid var(--t-color-border);
  }
  .t-calendar-heading {
    min-block-size: 2.75rem;
    padding: 0 var(--t-space-2);
    border: 1px solid transparent;
    border-radius: var(--t-radius-2);
    background: transparent;
    font-weight: var(--t-weight-medium);
    text-align: start;
  }
  .t-calendar-entries {
    display: grid;
    gap: var(--t-space-1);
    margin: 0;
    padding: 0 var(--t-space-2);
    list-style: none;
  }
  .t-calendar-entries li {
    display: flex;
    align-items: center;
    gap: var(--t-space-2);
  }
  .t-calendar-none {
    margin: 0;
    padding: 0 var(--t-space-2);
    color: var(--t-color-fg-muted);
  }
</style>
