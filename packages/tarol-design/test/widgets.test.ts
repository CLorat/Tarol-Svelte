import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '../dist/tokens.css';
import { expectAccessible } from './axe.js';
import Widgets from './fixtures/Widgets.svelte';

let app: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (app) await unmount(app);
  app = undefined;
  document.body.innerHTML = '';
});
function render<P extends Record<string, unknown>>(component: Component<P>, props: NoInfer<P> = {} as P): void {
  app = mount(component, { target: document.body, props });
  flushSync();
}
const values = () =>
  JSON.parse(document.querySelector('[data-testid=values]')?.textContent ?? '{}') as {
    artist: string | null;
    date: string | null;
    tab: string;
    chosen: string[];
    queries: string[];
  };
const focused = () => document.activeElement;
const open = (el: Element | null) => el?.closest('[popover]')?.matches(':popover-open') ?? false;

describe('combobox', () => {
  it('filters as you type, moves with the arrows and chooses with Enter', async () => {
    render(Widgets);
    const input = page.getByRole('combobox', { name: 'Artist' });
    await userEvent.click(input);
    await userEvent.keyboard('m');
    const list = document.querySelector('[role=listbox]');
    expect(open(list)).toBe(true);
    await expect.element(input).toHaveAttribute('aria-expanded', 'true');
    // "m" is in Monet, Morisot, Manet; Mary Cassatt too ("Mary")
    expect([...(list?.querySelectorAll('[role=option]') ?? [])].map((o) => o.textContent.trim())).toEqual([
      'Claude Monet',
      'Berthe Morisot',
      'Édouard Manet',
      'Mary Cassatt',
    ]);
    await userEvent.keyboard('o');
    expect(list?.querySelectorAll('[role=option]')).toHaveLength(2);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const active = input.element().getAttribute('aria-activedescendant');
    expect(document.getElementById(active ?? '')?.textContent.trim()).toBe('Berthe Morisot');
    expect(focused()).toBe(input.element()); // focus never leaves the input
    await expectAccessible();
    await userEvent.keyboard('{Enter}');
    expect(values().artist).toBe('morisot');
    await expect.element(input).toHaveValue('Berthe Morisot');
    expect(open(list)).toBe(false);
  });

  it('wraps, closes on Escape, clears on a second Escape', async () => {
    render(Widgets);
    const input = page.getByRole('combobox', { name: 'Artist' });
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}');
    const active = () => document.getElementById(input.element().getAttribute('aria-activedescendant') ?? '');
    expect(active()?.textContent.trim()).toBe('Mary Cassatt');
    await userEvent.keyboard('{ArrowDown}');
    expect(active()?.textContent.trim()).toBe('Claude Monet');
    await userEvent.keyboard('{Enter}');
    expect(values().artist).toBe('monet');
    await userEvent.keyboard('{ArrowDown}{Escape}');
    expect(open(document.querySelector('[role=listbox]'))).toBe(false);
    await userEvent.keyboard('{Escape}');
    await expect.element(input).toHaveValue('');
    expect(values().artist).toBeNull();
  });

  it('chooses by click, keeps the focus, and restores the label when left half-typed', async () => {
    render(Widgets);
    const input = page.getByRole('combobox', { name: 'Artist' });
    await userEvent.click(input);
    await userEvent.click(page.getByRole('option', { name: 'Édouard Manet' }));
    expect(values().artist).toBe('manet');
    expect(focused()).toBe(input.element());
    await userEvent.keyboard('{Backspace}{Backspace}x');
    await userEvent.tab();
    await expect.element(input).toHaveValue('Édouard Manet');
    expect(values().artist).toBe('manet');
  });

  it('shows the no-results text from the catalogue and reports queries for a server search', async () => {
    render(Widgets, { serverSide: true, locale: 'de' });
    const input = page.getByRole('combobox', { name: 'Artist' });
    await userEvent.click(input);
    await userEvent.keyboard('Ma');
    expect(values().queries).toEqual(['M', 'Ma']);
    expect(document.querySelectorAll('[role=option]')).toHaveLength(1);
    await userEvent.keyboard('x');
    await expect.element(page.getByText('Keine Treffer.')).toBeVisible();
    await expectAccessible();
  });
});

describe('date field', () => {
  it('binds an ISO date, null when empty, and passes axe', async () => {
    render(Widgets);
    const input = page.getByLabelText('Ends on');
    await expect.element(input).toHaveAttribute('type', 'date');
    await expect.element(input).toHaveAttribute('min', '2026-01-01');
    await userEvent.fill(input, '2026-12-24');
    expect(values().date).toBe('2026-12-24');
    await userEvent.clear(input);
    expect(values().date).toBeNull();
    await expectAccessible();
  });
});

describe('menu button', () => {
  it('opens on Enter at the first item, skips disabled items, chooses with Enter', async () => {
    render(Widgets);
    const button = page.getByRole('button', { name: 'Actions' });
    await expect.element(button).toHaveAttribute('aria-haspopup', 'menu');
    button.element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(button).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => focused()?.textContent.trim()).toBe('Edit');
    await expectAccessible();
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()?.textContent.trim()).toBe('Delete'); // Archive is disabled
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()?.textContent.trim()).toBe('Edit'); // wraps
    await userEvent.keyboard('{End}{Enter}');
    expect(values().chosen).toEqual(['delete']);
    expect(open(document.querySelector('[role=menu]'))).toBe(false);
    expect(focused()).toBe(button.element());
  });

  it('opens on Arrow Up at the last item; Escape closes and returns focus', async () => {
    render(Widgets);
    const button = page.getByRole('button', { name: 'Actions' });
    button.element().focus();
    await userEvent.keyboard('{ArrowUp}');
    await expect.poll(() => focused()?.textContent.trim()).toBe('Delete');
    await userEvent.keyboard('{Escape}');
    expect(open(document.querySelector('[role=menu]'))).toBe(false);
    expect(focused()).toBe(button.element());
    expect(values().chosen).toEqual([]);
  });

  it('toggles by click and closes on a click outside', async () => {
    render(Widgets);
    const button = page.getByRole('button', { name: 'Actions' });
    await userEvent.click(button);
    expect(open(document.querySelector('[role=menu]'))).toBe(true);
    await userEvent.click(button);
    expect(open(document.querySelector('[role=menu]'))).toBe(false);
    await userEvent.click(button);
    await userEvent.click(page.getByRole('heading', { name: 'Widgets' }));
    expect(open(document.querySelector('[role=menu]'))).toBe(false);
  });
});

describe('tabs', () => {
  it('one tab stop; arrows select with wrap; Home/End; the panel is labelled by its tab', async () => {
    render(Widgets);
    const details = page.getByRole('tab', { name: 'Details' });
    await expect.element(details).toHaveAttribute('aria-selected', 'true');
    await expect.element(page.getByRole('tab', { name: 'Bids' })).toHaveAttribute('tabindex', '-1');
    details.element().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(values().tab).toBe('bids');
    expect(focused()?.textContent).toBe('Bids');
    await expect.element(page.getByRole('tabpanel', { name: 'Bids' })).toHaveTextContent('Panel bids');
    await userEvent.keyboard('{End}');
    expect(values().tab).toBe('history');
    await userEvent.keyboard('{ArrowRight}');
    expect(values().tab).toBe('details');
    await userEvent.keyboard('{ArrowLeft}');
    expect(values().tab).toBe('history');
    await userEvent.keyboard('{Home}');
    expect(values().tab).toBe('details');
    await userEvent.tab();
    expect(focused()?.getAttribute('role')).toBe('tabpanel');
    await expectAccessible();
  });
});

describe('themes', () => {
  it.each(['light', 'dark'] as const)('the open widgets pass axe in the %s theme', async (theme) => {
    render(Widgets, { theme });
    await userEvent.click(page.getByRole('combobox', { name: 'Artist' }));
    await expectAccessible();
  });
});
