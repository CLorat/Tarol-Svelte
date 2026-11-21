// Contract test against the real backend sample (Tarol-Net samples/Sagas, started by its Aspire AppHost). Runs only with
// TAROL_E2E=1; TAROL_E2E_URL (default http://localhost:5080) and TAROL_E2E_ZITADEL (the setup's output folder, default
// $TMPDIR/artflow-zitadel) point at it. Tokens come from Zitadel by client credentials, as the sample's apphost.sh does.
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type Created, type Page, type TarolClient } from '../src/index.js';

const run = process.env['TAROL_E2E'] === '1';
const api = process.env['TAROL_E2E_URL'] ?? 'http://localhost:5080';
const zitadelDir = process.env['TAROL_E2E_ZITADEL'] ?? join(tmpdir(), 'artflow-zitadel');

async function token(user: string): Promise<string> {
  const line = readFileSync(join(zitadelDir, 'clients.txt'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`client ${user} `));
  const [, , id, secret] = line?.split(' ') ?? [];
  const project = readFileSync(join(zitadelDir, 'project.txt'), 'utf8').trim();
  const scope = `openid urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner urn:zitadel:iam:org:project:id:${project}:aud`;
  const r = await fetch('http://localhost:8080/oauth/v2/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${id ?? ''}:${secret ?? ''}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  });
  return ((await r.json()) as { access_token: string }).access_token;
}

interface AuctionRow {
  id: string;
  bids: number;
}

describe.runIf(run)('contract with samples/Sagas', () => {
  let alice: TarolClient;
  let bob: TarolClient;

  beforeAll(async () => {
    const [a, b] = await Promise.all([token('alice'), token('bob')]);
    alice = createClient({ baseUrl: api, tokens: { token: () => a, tenant: () => 'sample' } });
    bob = createClient({ baseUrl: api, tokens: { token: () => b, tenant: () => 'sample' } });
  });

  it('creates, replays the key, and refuses the key for another body', async () => {
    const key = crypto.randomUUID();
    const created = await alice.change<Created>({ method: 'POST', path: '/auctions', body: { reserve: 100 } }, { key });
    expect(created).toMatchObject({ ok: true, status: 201, version: 1, replayed: false });
    const again = await alice.change<Created>({ method: 'POST', path: '/auctions', body: { reserve: 100 } }, { key });
    expect(again).toMatchObject({ ok: true, status: 200, replayed: true });
    if (created.ok && again.ok) expect(again.value.id).toBe(created.value.id);
    const other = await alice.change({ method: 'POST', path: '/auctions', body: { reserve: 101 } }, { key });
    expect(other).toMatchObject({
      ok: false,
      status: 422,
      violation: { kind: 'error', code: 'Idempotency.KeyReused' },
    });
  });

  it('bids with the expected version and refuses a stale one', async () => {
    const created = await alice.change<Created>({ method: 'POST', path: '/auctions', body: { reserve: 100 } });
    if (!created.ok) throw new Error('create failed');
    const path = `/auctions/${created.value.id}/bids`;
    expect(await bob.change({ method: 'POST', path, body: { amount: 150 } }, { expectedVersion: 1 })).toMatchObject({
      ok: true,
      status: 204,
      version: 2,
    });
    expect(await bob.change({ method: 'POST', path, body: { amount: 160 } }, { expectedVersion: 1 })).toMatchObject({
      ok: false,
      status: 409,
      violation: { code: 'Stream.VersionConflict' },
    });
    expect(bob.position).toMatch(/^\d+\.\d+$/);
  });

  it('maps a malformed field and a refused row rule', async () => {
    expect(await alice.change({ method: 'POST', path: '/auctions', body: { reserve: 'x' } })).toEqual({
      ok: false,
      status: 400,
      requestId: expect.stringMatching(/^[0-9a-f]{32}$/) as string,
      violation: { kind: 'invalid', errors: { reserve: ['Json'] }, details: { reserve: [{ code: 'Json' }] } },
    });
    // the sample's rule [Range(1, 1_000_000)] on the reserve, with its bounds as the detail (BC-5, BC-9)
    expect(await alice.change({ method: 'POST', path: '/auctions', body: { reserve: 0 } })).toMatchObject({
      ok: false,
      status: 400,
      violation: {
        kind: 'invalid',
        errors: { reserve: ['Range'] },
        details: { reserve: [{ code: 'Range', detail: '1..1000000' }] },
      },
    });
    const created = await alice.change<Created>({ method: 'POST', path: '/auctions', body: { reserve: 100 } });
    if (!created.ok) throw new Error('create failed');
    expect(await bob.change({ method: 'POST', path: `/auctions/${created.value.id}/settle` })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('reads a view with its version and revalidates it to a 304', async () => {
    const created = await alice.change<Created>({ method: 'POST', path: '/auctions', body: { reserve: 100 } });
    if (!created.ok) throw new Error('create failed');
    const first = await alice.read(`/auctions/${created.value.id}`);
    expect(first).toMatchObject({ ok: true, status: 200, version: 1, notModified: false });
    expect(await alice.read(`/auctions/${created.value.id}`)).toMatchObject({
      ok: true,
      status: 304,
      notModified: true,
    });
  });

  it('pages a list with ETag revalidation and maps a bad limit', async () => {
    const first = await bob.read<Page<AuctionRow>>('/auctions', { query: { limit: 2, count: true } });
    expect(first).toMatchObject({ ok: true, status: 200 });
    const second = await bob.read<Page<AuctionRow>>('/auctions', { query: { limit: 2, count: true } });
    expect(second).toMatchObject({ ok: true, notModified: true });
    expect(await bob.read('/auctions', { query: { limit: 500 } })).toEqual({
      ok: false,
      status: 400,
      requestId: expect.any(String) as string,
      violation: {
        kind: 'invalid',
        errors: { limit: ['Range'] },
        details: { limit: [{ code: 'Range', detail: 'between 1 and 200' }] },
      },
    });
    // a key the list does not know is refused instead of being ignored (BC-14)
    expect(await bob.read('/auctions', { query: { selller: 'x' } })).toMatchObject({
      ok: false,
      status: 400,
      violation: { kind: 'invalid', errors: { selller: ['Unknown'] } },
    });
  });

  it('gives every answer a request id, the same as the problem trace id (BC-11)', async () => {
    const created = await alice.change<Created>({ method: 'POST', path: '/auctions', body: { reserve: 100 } });
    expect(created).toMatchObject({ ok: true, requestId: expect.stringMatching(/^[0-9a-f]{32}$/) as string });
    const missing = await alice.read('/auctions/01000000-0000-7000-8000-000000000000');
    expect(missing).toMatchObject({ ok: false, status: 404, violation: { code: 'Auction.NotFound' } });
    const raw = await fetch(`${api}/auctions/01000000-0000-7000-8000-000000000000`, {
      headers: { authorization: `Bearer ${await token('alice')}` },
    });
    expect(((await raw.json()) as { traceId: string }).traceId).toBe(raw.headers.get('tarol-request-id'));
  });

  it('answers 415 for a body without Content-Type; the client always sends it (BC-16)', async () => {
    const raw = await fetch(`${api}/auctions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await token('alice')}` },
      body: new Blob(['{"reserve":100}']), // a Blob without a type sends no Content-Type
    });
    expect(raw.status).toBe(415);
    expect(await alice.change({ method: 'POST', path: '/auctions', body: { reserve: 100 } })).toMatchObject({
      ok: true,
      status: 201,
    });
  });

  it('reports a missing token as Auth.Required', async () => {
    const anonymous = createClient({ baseUrl: api });
    expect(await anonymous.read('/auctions')).toEqual({
      ok: false,
      status: 401,
      violation: { kind: 'error', code: 'Auth.Required' },
    });
  });
});
