import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '../dist/tokens.css';
import { expectAccessible } from './axe.js';
import Consent from './fixtures/Consent.svelte';
import DialogHost from './fixtures/DialogHost.svelte';
import Form from './fixtures/Form.svelte';
import ToastHost from './fixtures/ToastHost.svelte';

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
  JSON.parse(document.querySelector('[data-testid=values]')?.textContent ?? '{}') as Record<string, unknown>;

describe('fields and buttons', () => {
  it('label, hint and error are wired to the input and pass axe', async () => {
    render(Form, { error: 'Enter between 3 and 80 characters.' });
    const input = page.getByLabelText(/Title/);
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    await expect.element(input).toHaveAccessibleDescription('3 to 80 characters Enter between 3 and 80 characters.');
    await expect.element(input).toBeRequired();
    await expectAccessible();
  });

  it('binds text and number values; an empty number is null', async () => {
    render(Form);
    await userEvent.type(page.getByLabelText(/Title/), 'Irises');
    await userEvent.type(page.getByLabelText('Reserve'), '150');
    expect(values()).toEqual({ title: 'Irises', reserve: 150 });
    await userEvent.clear(page.getByLabelText('Reserve'));
    expect(values()['reserve']).toBeNull();
  });

  it('a button is type=button by default and loading disables it with aria-busy', async () => {
    render(Form, { loading: true });
    const save = page.getByRole('button', { name: 'Save' });
    await expect.element(save).toHaveAttribute('type', 'button');
    await expect.element(save).toBeDisabled();
    await expect.element(save).toHaveAttribute('aria-busy', 'true');
  });

  it('is keyboard operable: Tab reaches the controls in order, Enter activates the button', async () => {
    render(Form);
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByLabelText(/Title/).element());
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toContain('Save');
    await userEvent.keyboard('{Enter}');
    expect(values()['title']).toBe('clicked');
  });

  it('German texts come from the de catalogue', async () => {
    render(Form, { locale: 'de' });
    await expect.element(page.getByText('(Pflichtfeld)')).toBeInTheDocument();
    expect(document.querySelector('.t-root')?.getAttribute('lang')).toBe('de');
  });
});

describe('checkbox (TS-4)', () => {
  const consent = () =>
    JSON.parse(document.querySelector('[data-testid=consent]')?.textContent ?? '{}') as { terms: boolean };

  it('is a labelled box with hint and error wired like every field, and passes axe', async () => {
    render(Consent, { error: 'Accept the terms to go on.' });
    const box = page.getByRole('checkbox', { name: /I accept the terms/ });
    await expect.element(box).toHaveAttribute('aria-invalid', 'true');
    await expect.element(box).toHaveAccessibleDescription('Read them first Accept the terms to go on.');
    await expect.element(box).toBeRequired();
    await expectAccessible();
  });

  it('binds checked from a click on the label and from the keyboard (Space)', async () => {
    render(Consent);
    await userEvent.click(document.querySelector('label')!);
    expect(consent().terms).toBe(true);
    expect(document.activeElement).toBe(page.getByRole('checkbox').element()); // the label click focuses the box
    await userEvent.keyboard(' ');
    expect(consent().terms).toBe(false);
  });

  it('shows the required marker after a space, in German too', async () => {
    render(Consent, { locale: 'de' });
    expect(document.querySelector('label')?.textContent?.trim()).toBe('I accept the terms (Pflichtfeld)');
    expect(page.getByRole('checkbox').element().getBoundingClientRect().height).toBeGreaterThanOrEqual(20);
  });
});

describe('themes', () => {
  const token = (name: string) => getComputedStyle(document.querySelector('.t-root')!).getPropertyValue(name).trim();

  it('applies light and dark tokens and the compact density only inside .t-root', async () => {
    render(Form, { theme: 'dark', density: 'compact' });
    expect(token('--t-color-bg')).toBe('#15171c');
    expect(token('--t-density')).toBe('0.75');
    expect(getComputedStyle(document.body).getPropertyValue('--t-color-bg')).toBe(''); // nothing global
    await expectAccessible();
  });

  it('light theme passes axe too', async () => {
    render(Form, { theme: 'light' });
    expect(token('--t-color-bg')).toBe('#ffffff');
    await expectAccessible();
  });
});

// A closed <dialog> leaves the accessibility tree, so role locators cannot find it to assert "not visible".
const isOpen = () => document.querySelector('dialog')?.open ?? false;

describe('dialog', () => {
  it('opens modal with focus inside, closes on Escape and returns focus to the opener', async () => {
    render(DialogHost);
    const opener = page.getByRole('button', { name: 'Open' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Delete auction' });
    await expect.element(dialog).toBeVisible();
    expect(dialog.element().contains(document.activeElement)).toBe(true);
    await expectAccessible();
    await userEvent.keyboard('{Escape}');
    await expect.poll(isOpen).toBe(false);
    expect(document.activeElement).toBe(opener.element());
    await expect.element(page.getByTestId('closed')).toHaveTextContent('1');
  });

  it('closes from its footer, its close button and the backdrop', async () => {
    render(DialogHost);
    await page.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Keep' }).click();
    await expect.poll(isOpen).toBe(false);
    await page.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(isOpen).toBe(false);
    await page.getByRole('button', { name: 'Open' }).click();
    // a click on the ::backdrop reaches the <dialog> element itself as the target (the panel fills the dialog's box)
    document.querySelector('dialog')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect.poll(isOpen).toBe(false);
  });

  it('a non-dismissible dialog ignores Escape and has no close button', async () => {
    render(DialogHost, { dismissible: false });
    await page.getByRole('button', { name: 'Open' }).click();
    await userEvent.keyboard('{Escape}');
    expect(isOpen()).toBe(true);
    expect(page.getByRole('button', { name: 'Close' }).query()).toBeNull();
  });
});

describe('toasts', () => {
  it('announces info politely and errors assertively; info disappears after its timeout', async () => {
    vi.useFakeTimers();
    try {
      render(ToastHost);
      page
        .getByRole('button', { name: 'Info' })
        .element()
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      page
        .getByRole('button', { name: 'Error' })
        .element()
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      flushSync();
      expect(document.querySelector('[role=status]')?.textContent).toContain('Bid placed');
      expect(document.querySelector('[role=alert]')?.textContent).toContain('Payment failed');
      vi.advanceTimersByTime(1000);
      flushSync();
      expect(document.querySelector('[role=status]')?.textContent).not.toContain('Bid placed');
      expect(document.querySelector('[role=alert]')?.textContent).toContain('Payment failed');
    } finally {
      vi.useRealTimers();
    }
    await expectAccessible();
  });
});
