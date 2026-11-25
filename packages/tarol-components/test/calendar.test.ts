import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@clorat/tarol-design/tokens.css';
import { expectAccessible, violations } from './axe.js';
import { addMonths, monthGrid } from '../src/lib/days.js';
import CalendarHost from './fixtures/CalendarHost.svelte';

let app: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  document.body.innerHTML = '';
});
function render<P extends Record<string, unknown>>(component: Component<P>, props: NoInfer<P>): void {
  app = mount(component, { target: document.body, props });
  flushSync();
}
const state = () => document.querySelector('[data-testid=state]')?.textContent ?? '';
const focused = () => (document.activeElement as HTMLElement | null)?.dataset['day'];
// axe's rule for WCAG 2.5.3 (label in name) is experimental: it only runs when enabled
const nameRule = ['label-content-name-mismatch'];

describe('Calendar (TS-34, Tatalu FB-F06.1-2)', () => {
  it('shows a month as a grid of six weeks with one tab stop, today and the chosen day marked, and passes axe', async () => {
    render(CalendarHost, {});
    const grid = page.getByRole('grid', { name: 'December 2026' });
    await expect.element(grid).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(document.querySelectorAll('[role=grid] button[tabindex="0"]')).toHaveLength(1);
    await expect.element(page.getByRole('columnheader', { name: 'Mon' })).toHaveAttribute('abbr', 'Monday');
    await expect
      .element(page.getByRole('button', { name: 'Thursday, December 3, 2026' }))
      .toHaveAttribute('aria-current', 'date');
    expect(document.querySelector('td[aria-selected=true] button')?.getAttribute('data-day')).toBe('2026-12-01');
    await expectAccessible(document.body, nameRule);
  });

  it('names a day by its full date around the visible number, with the entry count, and shows dots', async () => {
    render(CalendarHost, {});
    const first = page.getByRole('button', { name: 'Tuesday, December 1, 2026, entries: 2' });
    await expect.element(first).toBeInTheDocument();
    // only the number is visible
    expect(first.element().querySelector('.t-calendar-num > [aria-hidden=true]')?.textContent).toBe('1');
    expect(first.element().querySelectorAll('.t-calendar-dot')).toHaveLength(2);
    const eve = page.getByRole('button', { name: /December 24, 2026, entries: 4/ }).element();
    expect(eve.querySelectorAll('.t-calendar-dot')).toHaveLength(3);
    expect(eve.querySelector('.t-calendar-dots')?.getAttribute('data-more')).toBe('1');
  });

  it('proves the name rule runs: an aria-label without the visible number is reported', async () => {
    document.body.innerHTML = '<main><button type="button" aria-label="01.12.2026">1</button></main>';
    expect((await violations(document.body, nameRule)).join()).toContain('label-content-name-mismatch');
  });

  it('moves by keyboard after the WAI-ARIA grid pattern; focus follows across months', async () => {
    render(CalendarHost, {});
    await userEvent.tab(); // Previous
    await userEvent.tab(); // Next
    await userEvent.tab(); // Today
    await userEvent.tab(); // Month, Week, Day
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(focused()).toBe('2026-12-01');
    const keys: [string, string][] = [
      ['{ArrowRight}', '2026-12-02'],
      ['{ArrowDown}', '2026-12-09'],
      ['{ArrowLeft}', '2026-12-08'],
      ['{ArrowUp}', '2026-12-01'],
      ['{Control>}{End}{/Control}', '2026-12-31'],
      ['{Control>}{Home}{/Control}', '2026-12-01'],
      ['{End}', '2026-12-06'],
      ['{Home}', '2026-11-30'], // the first day of the week is in November: the grid follows
      ['{PageDown}', '2026-12-30'],
      ['{PageUp}', '2026-11-30'],
      ['{Shift>}{PageDown}{/Shift}', '2027-11-30'],
      ['{Shift>}{PageUp}{/Shift}', '2026-11-30'],
      ['{ArrowUp}', '2026-11-23'],
    ];
    for (const [key, day] of keys) {
      await userEvent.keyboard(key);
      expect({ key, day: focused() }).toEqual({ key, day });
    }
    await expect.element(page.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
    expect(state()).toBe('2026-11-23 month');
    await userEvent.tab(); // leaves the grid: one tab stop
    expect(document.activeElement?.closest('[role=grid]')).toBeNull();
  });

  it('clamps a month step to the last day of the shorter month', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', -12)).toBe('2025-12-15');
    expect(monthGrid('2026-02-10', 1)[0]?.[0]).toBe('2026-01-26');
  });

  it('Enter on a day opens the day view with its entries as dot and text; without onselect only', async () => {
    render(CalendarHost, {});
    page
      .getByRole('button', { name: /^Tuesday, December 1, 2026/ })
      .element()
      .focus();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(state()).toBe('2026-12-02 day');
    await expect.element(page.getByText('No entries.')).toBeInTheDocument();
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect.element(page.getByText('Tuesday, December 1, 2026')).toBeInTheDocument();
    await expect.element(page.getByRole('listitem').filter({ hasText: 'Parents evening' })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true');
    await expectAccessible(document.body, nameRule);
  });

  it('calls onselect instead when given', async () => {
    const onselect = vi.fn();
    render(CalendarHost, { onselect });
    await page.getByRole('button', { name: /^Thursday, December 24, 2026/ }).click();
    expect(onselect).toHaveBeenCalledWith('2026-12-24');
    expect(state()).toBe('2026-12-24 month');
  });

  it('shows a week as seven rows with their entries; arrows move by a day, Page keys by a week', async () => {
    render(CalendarHost, { view: 'week' });
    await expect.element(page.getByRole('grid', { name: 'Week of November 30, 2026' })).toBeInTheDocument();
    expect(document.querySelectorAll('[role=grid] tr')).toHaveLength(7);
    const day = page.getByRole('button', { name: 'Tuesday, December 1, 2026, entries: 2' });
    expect(day.element().querySelector('[aria-hidden=true]')?.textContent).toBe('Tuesday, December 1');
    await expect.element(page.getByRole('gridcell').filter({ hasText: 'Parents evening' })).toBeInTheDocument();
    day.element().focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toBe('2026-12-02');
    await userEvent.keyboard('{PageDown}');
    expect(focused()).toBe('2026-12-09');
    await userEvent.keyboard('{End}');
    expect(focused()).toBe('2026-12-13');
    await expectAccessible(document.body, nameRule);
  });

  it('the toolbar steps by the view and returns to today; German texts and dates come with the locale', async () => {
    render(CalendarHost, { locale: 'de' });
    await expect.element(page.getByRole('grid', { name: 'Dezember 2026' })).toBeInTheDocument();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect.element(page.getByRole('grid', { name: 'Januar 2027' })).toBeInTheDocument();
    await page.getByRole('button', { name: 'Heute' }).click();
    expect(state()).toBe('2026-12-03 month');
    await expect
      .element(page.getByRole('button', { name: 'Dienstag, 1. Dezember 2026, Einträge: 2' }))
      .toBeInTheDocument();
    await expectAccessible(document.body, nameRule);
  });
});
