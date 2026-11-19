import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@clorat/tarol-design/tokens.css';
import { expectAccessible } from './axe.js';
import { fakeClient } from './fake.js';
import BidForm from './fixtures/BidForm.svelte';
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
    await expect.element(page.getByRole('cell', { name: 'Auction 1' })).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(2);
    await expectAccessible();
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect.element(page.getByRole('cell', { name: 'Auction 2' })).toBeInTheDocument();
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
    await expect.element(page.getByRole('cell', { name: 'Auction 0', exact: true })).toBeInTheDocument();
    const rendered = document.querySelectorAll('tbody tr:not([aria-hidden])').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThanOrEqual(60);
    expect(document.querySelector('table')?.getAttribute('aria-rowcount')).toBe('1001');
    const scroller = document.querySelector<HTMLElement>('.t-table-scroll')!;
    scroller.scrollTop = 500 * 40;
    scroller.dispatchEvent(new Event('scroll'));
    await expect.element(page.getByRole('cell', { name: 'Auction 500', exact: true })).toBeInTheDocument();
    expect(page.getByRole('cell', { name: 'Auction 0', exact: true }).query()).toBeNull();
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

  it('binds by path, submits with Enter and puts the server field error on its field', async () => {
    const f = fakeClient(0, () => ({
      ok: false,
      status: 400,
      violation: { kind: 'invalid', errors: { reserve: ['Range'] } },
    }));
    render(BidForm, { client: f.client });
    await userEvent.type(page.getByLabelText(/Title/), 'Irises');
    await userEvent.type(page.getByLabelText('Reserve'), '5{Enter}');
    expect(JSON.parse(page.getByTestId('values').element().textContent)).toEqual({ title: 'Irises', reserve: 5 });
    await expect
      .element(page.getByLabelText('Reserve'))
      .toHaveAccessibleDescription('Enter a value between 1 and 1000000.');
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
