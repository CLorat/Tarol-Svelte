// The generated client against the running sample (TAROL_E2E=1; see packages/tarol-client/test/contract.test.ts).
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asId, createClient } from '@clorat/tarol-client';
import { describe, expect, it } from 'vitest';
import { generate, type OpenApiDocument } from '../src/generate.js';
import { tarol } from './__snapshots__/artflow.js';

const run = process.env['TAROL_E2E'] === '1';
const api = process.env['TAROL_E2E_URL'] ?? 'http://localhost:5080';
const zitadel = process.env['TAROL_E2E_ZITADEL'] ?? join(tmpdir(), 'artflow-zitadel');

async function token(user: string): Promise<string> {
  const [, , id, secret] =
    readFileSync(join(zitadel, 'clients.txt'), 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`client ${user} `))
      ?.split(' ') ?? [];
  const project = readFileSync(join(zitadel, 'project.txt'), 'utf8').trim();
  const r = await fetch('http://localhost:8080/oauth/v2/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${id ?? ''}:${secret ?? ''}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: `openid urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner urn:zitadel:iam:org:project:id:${project}:aud`,
    }),
  });
  return ((await r.json()) as { access_token: string }).access_token;
}

describe.runIf(run)('generated client against samples/Sagas', () => {
  it('the live document generates exactly the committed snapshot (no drift)', async () => {
    const live = (await (await fetch(`${api}/openapi/v1.json`)).json()) as OpenApiDocument;
    const fixture = JSON.parse(
      readFileSync(new URL('fixtures/artflow.openapi.json', import.meta.url), 'utf8'),
    ) as OpenApiDocument;
    expect(generate(live, { source: 'artflow.openapi.json' })).toBe(
      generate(fixture, { source: 'artflow.openapi.json' }),
    );
  });

  it('creates, bids, settles and lists through the generated calls', async () => {
    const [a, b] = await Promise.all([token('alice'), token('bob')]);
    const alice = tarol(createClient({ baseUrl: api, tokens: { token: () => a, tenant: () => 's' } }));
    const bob = tarol(createClient({ baseUrl: api, tokens: { token: () => b, tenant: () => 's' } }));
    const created = await alice.changes.createAuction({ reserve: 100 });
    if (!created.ok) throw new Error(JSON.stringify(created.violation));
    const auction = asId<'Auction'>(created.value.id); // the 201 id has no x-tarol-id yet (BC-19)
    expect(await bob.changes.placeBid({ auction, amount: 150 }, { expectedVersion: 1 })).toMatchObject({
      ok: true,
      version: 2,
    });
    expect(await bob.changes.settleAuction({ auction })).toMatchObject({ ok: false, status: 403 });
    expect(await alice.changes.settleAuction({ auction })).toMatchObject({ ok: true, status: 204 });
    expect(await alice.queries.auctionView({ auction })).toMatchObject({
      ok: true,
      value: { id: auction, settled: true },
    });
    const page = await bob.queries.auctionSearch({ limit: 2, count: true });
    expect(page).toMatchObject({ ok: true });
    if (page.ok) expect(page.value.items.length).toBeLessThanOrEqual(2);
  });
});
