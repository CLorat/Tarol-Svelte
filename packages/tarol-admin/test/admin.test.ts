import { en } from '@clorat/tarol-design';
import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@clorat/tarol-design/tokens.css';
import { adminDe, adminEn, adminErrors } from '../src/lib/index.js';
import { expectAccessible } from './axe.js';
import { fakeAdmin } from './fake.js';
import Host from './fixtures/Host.svelte';

let mounted: ReturnType<typeof mount> | undefined;
function render<P extends Record<string, unknown>>(component: Component<P>, props: NoInfer<P>): void {
  mounted = mount(component, { target: document.body, props });
  flushSync();
}
afterEach(() => {
  if (mounted) void unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

describe('dead letters', () => {
  it('lists the kinds and the dead letters, re-drives and discards after a confirmation', async () => {
    const f = fakeAdmin();
    render(Host, { client: f.client });
    await expect.element(page.getByRole('combobox', { name: 'Kind' })).toHaveValue('jobs');
    await userEvent.selectOptions(page.getByRole('combobox', { name: 'Kind' }), 'reactions');
    const grid = page.getByRole('grid', { name: 'Dead letters' });
    await expect.element(grid.getByText('Reactions.Step2')).toBeInTheDocument();
    await expectAccessible();

    await page.getByRole('button', { name: 'Actions 1' }).click();
    await page.getByRole('menuitem', { name: 'Re-drive' }).click();
    await expect.element(page.getByRole('dialog').getByText('Re-drive dead letter 1? It runs again.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect.element(page.getByText('Re-driven: 1.')).toBeInTheDocument();
    expect(f.calls).toContainEqual({ method: 'POST', path: '/tarol/admin/dead/reactions/1/redrive', query: {} });

    await page.getByRole('button', { name: 'Actions 2' }).click();
    await page.getByRole('menuitem', { name: 'Discard' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(f.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0); // cancelled: nothing sent
    await page.getByRole('button', { name: 'Actions 2' }).click();
    await page.getByRole('menuitem', { name: 'Discard' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect.element(page.getByText('Discarded.')).toBeInTheDocument();
    expect(f.calls).toContainEqual({ method: 'DELETE', path: '/tarol/admin/dead/reactions/2', query: {} });

    await page.getByRole('button', { name: 'Re-drive all' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect.element(page.getByText('Re-driven: 2.')).toBeInTheDocument();
  });

  it('shows a refused action by its code and reference', async () => {
    const f = fakeAdmin((c) =>
      c.method === 'POST'
        ? {
            ok: false,
            status: 404,
            requestId: 'r-9',
            violation: { kind: 'error', code: 'Admin.NotFound', detail: 'no dead letter 1 of kind reactions' },
          }
        : undefined,
    );
    render(Host, { client: f.client, prefix: '/ops/' });
    await userEvent.selectOptions(page.getByRole('combobox', { name: 'Kind' }), 'reactions');
    await page.getByRole('button', { name: 'Actions 1' }).click();
    await page.getByRole('menuitem', { name: 'Re-drive' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect
      .element(page.getByText('This dead letter does not exist (any more). Reference: r-9'))
      .toBeInTheDocument();
    expect(f.calls).toContainEqual({ method: 'POST', path: '/ops/dead/reactions/1/redrive', query: {} });
  });

  it('shows the 403 of a user without the admin role, with its reference', async () => {
    const f = fakeAdmin(() => ({
      ok: false,
      status: 403,
      requestId: 'r-1',
      violation: { kind: 'error', code: 'Auth.Forbidden' },
    }));
    render(Host, { client: f.client });
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('You are not allowed to do this. Reference: r-1 Try again');
    await expectAccessible();
  });
});

describe('projections', () => {
  it('offers to drop only a superseded version, and shows the backend refusal', async () => {
    let refuse = false;
    const f = fakeAdmin((c) =>
      c.method === 'DELETE' && refuse
        ? { ok: false, status: 409, violation: { kind: 'error', code: 'Projection.Drop' } }
        : undefined,
    );
    render(Host, { client: f.client, section: 'projections' });
    const table = page.getByRole('table', { name: 'Projections' });
    await expect.element(table.getByRole('row')).toHaveLength(3);
    expect(document.querySelectorAll('tbody button')).toHaveLength(1); // the current version has no drop
    await page.getByRole('button', { name: 'Drop auction-list v1' }).click();
    await expect
      .element(page.getByRole('dialog').getByText('Drop auction-list v1? Its table is deleted.'))
      .toBeVisible();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect.element(page.getByText('Dropped.')).toBeInTheDocument();
    expect(f.calls).toContainEqual({ method: 'DELETE', path: '/tarol/admin/projections/auction-list/1', query: {} });
    refuse = true;
    await page.getByRole('button', { name: 'Drop auction-list v1' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect.element(page.getByText('Only superseded versions can be dropped.')).toBeInTheDocument();
    await expectAccessible();
  });
});

describe('data subject', () => {
  const id = '01a1fa48-b4d9-7175-9ea2-afe1328ee641';

  it('exports as a download, and erases after typing the id; an incomplete erasure can be repeated (BC-10)', async () => {
    let incomplete = true;
    const f = fakeAdmin((c) => {
      if (!c.path.endsWith('/erase') || !incomplete) return undefined;
      incomplete = false;
      return {
        ok: false,
        status: 409,
        requestId: 'r-5',
        violation: {
          kind: 'error',
          code: 'DataProtection.ErasureIncomplete',
          detail: 'search',
          extensions: { failed: ['search'] },
        },
      };
    });
    render(Host, { client: f.client, section: 'subject' });
    await userEvent.type(page.getByLabelText(/Subject id/), id);
    await page.getByRole('button', { name: 'Export' }).click();
    const link = page.getByRole('link', { name: 'Download the export (1 events)' });
    await expect.element(link).toHaveAttribute('download', `${id}.json`);
    expect(f.calls).toContainEqual({
      method: 'GET',
      path: `/tarol/admin/subjects/${id}/export`,
      query: { tenant: '00000000-0000-0000-0000-000000000000' },
    });

    await page.getByRole('button', { name: 'Erase personal data' }).click();
    const dialog = page.getByRole('dialog');
    const erase = dialog.getByRole('button', { name: 'Erase personal data' });
    await expect.element(erase).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/Type the subject id/), id);
    await expect.element(erase).toBeEnabled();
    await erase.click();
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'The erasure did not finish everywhere. Reference: r-5 Not finished in: search. Try again. Try again',
      );
    expect(f.calls).toContainEqual({
      method: 'POST',
      path: `/tarol/admin/subjects/${id}/erase`,
      query: { tenant: '00000000-0000-0000-0000-000000000000' },
    });
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect.element(page.getByRole('status').getByText('Erased (1 streams).')).toBeInTheDocument();
    await expectAccessible();
  });

  it('speaks German with adminDe', async () => {
    render(Host, { client: fakeAdmin().client, section: 'subject', locale: 'de' });
    await expect.element(page.getByRole('button', { name: 'Personenbezogene Daten löschen' })).toBeInTheDocument();
  });
});

describe('messages', () => {
  it('has the same keys in English and German, and a message for every code of the admin entry', () => {
    expect(Object.keys(adminDe).sort()).toEqual(Object.keys(adminEn).sort());
    const codes = new Set(Object.values(adminErrors).flat());
    for (const code of codes) expect(code in adminEn || code in en, code).toBe(true);
  });
});
