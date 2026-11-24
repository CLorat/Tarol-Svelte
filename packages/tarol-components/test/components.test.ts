import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@clorat/tarol-design/tokens.css';
import { expectAccessible } from './axe.js';
import { fakeClient } from './fake.js';
import type { Result } from '@clorat/tarol-client';
import BidForm from './fixtures/BidForm.svelte';
import ConsentForm from './fixtures/ConsentForm.svelte';
import Failing from './fixtures/Failing.svelte';
import Table from './fixtures/Table.svelte';

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

describe('DataTable in QueryState and AppShell', () => {
  it('shows the first page, appends the next with the button, and passes axe', async () => {
    const f = fakeClient(3);
    render(Table, { client: f.client });
    await expect.element(page.getByRole('gridcell', { name: 'Auction 1' })).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(2);
    await expectAccessible();
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect.element(page.getByRole('gridcell', { name: 'Auction 2' })).toBeInTheDocument();
    await expect.poll(() => page.getByRole('button', { name: 'Load more' }).query()).toBeNull();
    // other reads may be revalidations (the click focuses the window); the page read is the one with the cursor
    expect(f.reads.filter((r) => r.query['after'] !== undefined).map((r) => r.query['after'])).toEqual(['c2']);
  });

  it('a header switches the backend sort and marks it with aria-sort', async () => {
    const f = fakeClient(3);
    render(Table, { client: f.client });
    await expect.element(page.getByRole('columnheader', { name: /Bids/ })).toHaveAttribute('aria-sort', 'descending');
    await page.getByRole('button', { name: /^Title/ }).click();
    await expect.element(page.getByTestId('sort')).toHaveTextContent('Title');
    await expect.element(page.getByRole('columnheader', { name: /Title/ })).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(() => f.reads.at(-1)?.query['sort']).toBe('Title');
    expect(f.reads.at(-1)?.query['after']).toBeUndefined(); // a new sort starts at page 1
  });

  it('renders at most a window of rows above 200 (virtualization)', async () => {
    const f = fakeClient(1000);
    render(Table, { client: f.client, limit: 1000 });
    await expect.element(page.getByRole('gridcell', { name: 'Auction 0', exact: true })).toBeInTheDocument();
    const rendered = document.querySelectorAll('tbody tr:not([aria-hidden])').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThanOrEqual(60);
    expect(document.querySelector('table')?.getAttribute('aria-rowcount')).toBe('1001');
    const scroller = document.querySelector<HTMLElement>('.t-table-scroll')!;
    scroller.scrollTop = 500 * 40;
    scroller.dispatchEvent(new Event('scroll'));
    await expect.element(page.getByRole('gridcell', { name: 'Auction 500', exact: true })).toBeInTheDocument();
    expect(page.getByRole('gridcell', { name: 'Auction 0', exact: true }).query()).toBeNull();
  });

  it('is a grid with one tab stop: arrows, Home/End, Ctrl+End and Page Down move the focus', async () => {
    render(Table, { client: fakeClient(25).client, limit: 50 });
    await expect.element(page.getByRole('grid', { name: 'Auctions' })).toBeInTheDocument();
    await expect.element(page.getByRole('gridcell', { name: 'Auction 24' })).toBeInTheDocument();
    // the one tab stop is the first header's sort button
    page.getByRole('link', { name: 'Skip to content' }).element().focus();
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toContain('Title');
    const focused = () => document.activeElement?.closest('td, th')?.textContent.trim();
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toBe('Auction 0');
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('0');
    await userEvent.keyboard('{ArrowRight}'); // stays at the edge
    expect(focused()).toBe('0');
    await userEvent.keyboard('{PageDown}');
    expect(focused()).toBe(String(10 % 7));
    await userEvent.keyboard('{Home}');
    expect(focused()).toBe('Auction 10');
    await userEvent.keyboard('{Control>}{End}{/Control}');
    expect(focused()).toBe(String(24 % 7));
    await userEvent.keyboard('{Control>}{Home}{/Control}');
    expect(focused()).toContain('Title');
    // only one element of the grid is in the tab order
    const tabbable = [...document.querySelectorAll<HTMLElement>('table *')].filter((e) => e.tabIndex >= 0);
    expect(tabbable).toHaveLength(1);
    await expectAccessible();
  });

  it('focuses the widget of a cell, and reaches virtual rows by scrolling', async () => {
    render(Table, { client: fakeClient(1000).client, limit: 1000, links: true });
    await expect.element(page.getByRole('link', { name: 'Auction 0', exact: true })).toBeInTheDocument();
    page.getByRole('link', { name: 'Auction 0', exact: true }).element().focus();
    expect(document.activeElement?.tagName).toBe('A');
    for (let i = 0; i < 30; i++) await userEvent.keyboard('{PageDown}');
    await expect.poll(() => document.activeElement?.textContent).toBe('Auction 300');
    expect(document.activeElement?.tagName).toBe('A');
    await userEvent.keyboard('{Control>}{End}{/Control}');
    await expect.poll(() => document.activeElement?.closest('td')?.textContent.trim()).toBe(String(999 % 7));
  });

  it('has a skip link to the main landmark and a named navigation', async () => {
    render(Table, { client: fakeClient(1).client });
    await expect.element(page.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#t-main');
    await expect.element(page.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    await expect.element(page.getByRole('main')).toBeInTheDocument();
  });
});

describe('ChangeForm and FormField', () => {
  it('checks rules on blur with the message and bounds, and does not send', async () => {
    let sent = 0;
    render(BidForm, {
      client: fakeClient(
        0,
        () => (
          (sent += 1),
          { ok: true, value: undefined, status: 201, replayed: false, stale: false, notModified: false }
        ),
      ).client,
    });
    const title = page.getByLabelText(/Title/);
    await userEvent.type(title, 'ab');
    await userEvent.tab();
    await expect.element(title).toHaveAccessibleDescription('Enter between 3 and 80 characters.');
    await page.getByRole('button', { name: 'Create' }).click();
    expect(sent).toBe(0);
    await expectAccessible();
  });

  it('sends with one click after a blocked submit was corrected (the error clears while typing)', async () => {
    let sent = 0;
    const f = fakeClient(0, () => {
      sent += 1;
      return { ok: true, value: undefined, status: 201, replayed: false, stale: false, notModified: false };
    });
    render(BidForm, { client: f.client });
    await page.getByRole('button', { name: 'Create' }).click();
    const title = page.getByLabelText(/Title/);
    await expect.element(title).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(title, 'Irises');
    await expect.element(title).not.toHaveAttribute('aria-invalid'); // before the blur: no layout shift on the click
    await page.getByRole('button', { name: 'Create' }).click();
    await expect.poll(() => sent).toBe(1);
  });

  it('binds by path, submits with Enter and puts the server field error on its field', async () => {
    const f = fakeClient(0, () => ({
      ok: false,
      status: 400,
      violation: { kind: 'invalid', errors: { reserve: ['Range'] }, details: { reserve: [{ code: 'Range' }] } },
    }));
    render(BidForm, { client: f.client });
    await userEvent.type(page.getByLabelText(/Title/), 'Irises');
    await userEvent.type(page.getByLabelText('Reserve'), '5{Enter}');
    expect(JSON.parse(page.getByTestId('values').element().textContent)).toEqual({ title: 'Irises', reserve: 5 });
    await expect
      .element(page.getByLabelText('Reserve'))
      .toHaveAccessibleDescription('Enter a value between 1 and 1000000.');
  });

  it('a checkbox field binds a boolean by path and gets the server error of its path (TS-4)', async () => {
    let sent = 0;
    const f = fakeClient(
      0,
      () => (
        (sent += 1),
        {
          ok: false,
          status: 400,
          violation: { kind: 'invalid', errors: { 'consents.terms': ['Required'] }, details: {} },
        }
      ),
    );
    render(ConsentForm, { client: f.client });
    const terms = page.getByRole('checkbox', { name: /I accept the terms/ });
    await page.getByRole('checkbox', { name: 'Photos may be shared' }).click();
    expect(JSON.parse(page.getByTestId('values').element().textContent).consents).toEqual({
      terms: false,
      photos: true,
    });
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect.poll(() => sent).toBe(1);
    await expect.element(terms).toHaveAttribute('aria-invalid', 'true');
    await expect.element(terms).toHaveAccessibleDescription('This field is required.');
    await expectAccessible();
    await terms.click(); // touched on the change: the server's error is gone at once
    await expect.element(terms).not.toHaveAttribute('aria-invalid');
    expect(JSON.parse(page.getByTestId('values').element().textContent).consents.terms).toBe(true);
  });

  it('shows the bounds of the server detail on a field without client rules', async () => {
    const f = fakeClient(0, () => ({
      ok: false,
      status: 400,
      requestId: '1ab7b7af266c4111b857fa99a936bc1b',
      violation: {
        kind: 'invalid',
        errors: { reserve: ['Range'] },
        details: { reserve: [{ code: 'Range', detail: '1..1000000' }] },
      },
    }));
    render(BidForm, { client: f.client, clientRules: false });
    await userEvent.type(page.getByLabelText(/Title/), 'Irises');
    await userEvent.type(page.getByLabelText('Reserve'), '0{Enter}');
    await expect
      .element(page.getByLabelText('Reserve'))
      .toHaveAccessibleDescription('Enter a value between 1 and 1000000.');
  });

  it('shows the request id of a refusal as its reference', async () => {
    const f = fakeClient(0, () => ({
      ok: false,
      status: 403,
      requestId: 'r-42',
      violation: { kind: 'error', code: 'Auth.Forbidden' },
    }));
    render(BidForm, { client: f.client });
    await userEvent.type(page.getByLabelText(/Title/), 'Irises');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect.element(page.getByRole('alert')).toHaveTextContent('You are not allowed to do this. Reference: r-42');
    await expectAccessible();
  });

  it('shows the request id of a failed read in QueryState', async () => {
    const f = fakeClient(0);
    f.client.read = <T>() =>
      Promise.resolve({
        ok: false,
        status: 404,
        requestId: 'r-7',
        violation: { kind: 'error', code: 'NotFound' },
      } as Result<T>);
    render(Failing, { client: f.client });
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('This item does not exist (any more). Reference: r-7 Try again');
  });

  it('announces a coded refusal above the button, in German with the de catalogue', async () => {
    const f = fakeClient(0, () => ({ ok: false, status: 403, violation: { kind: 'error', code: 'Auth.Forbidden' } }));
    render(BidForm, { client: f.client, locale: 'de' });
    await userEvent.type(page.getByLabelText(/Title/), 'Irises');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect.element(page.getByRole('alert')).toHaveTextContent('Dazu fehlt Ihnen die Berechtigung.');
    await expectAccessible();
  });
});
