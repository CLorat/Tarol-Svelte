// Contract test against the real sample (Tarol-Net samples/Sagas: Zitadel v4.20.3 on :8080, the API on :5080). Runs only
// with TAROL_E2E=1, like the client's. The sample has machine users only (BC-9 adds a PKCE app), so the browser login
// itself is not run here: it checks discovery and the authorization request against the real Zitadel, and that the
// preset reads real Zitadel tokens the way the backend does (the roles the backend enforces).
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createOidc } from '../src/index.js';
import { zitadel, zitadelClaims, zitadelTenant } from '../src/zitadel.js';
import { memoryStorage } from './fake-server.js';

const run = process.env['TAROL_E2E'] === '1';
const api = process.env['TAROL_E2E_URL'] ?? 'http://localhost:5080';
const issuer = process.env['TAROL_E2E_ISSUER'] ?? 'http://localhost:8080';
const zitadelDir = process.env['TAROL_E2E_ZITADEL'] ?? join(tmpdir(), 'artflow-zitadel');
const project = (): string => readFileSync(join(zitadelDir, 'project.txt'), 'utf8').trim();

async function accessToken(user: string): Promise<string> {
  const line = readFileSync(join(zitadelDir, 'clients.txt'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`client ${user} `));
  const [, , id, secret] = line?.split(' ') ?? [];
  const r = await fetch(`${issuer}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${id ?? ''}:${secret ?? ''}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    // the preset's scopes, minus offline_access (no refresh tokens for client credentials)
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: `openid urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner urn:zitadel:iam:org:project:id:${project()}:aud`,
    }),
  });
  return ((await r.json()) as { access_token: string }).access_token;
}

const payload = (jwt: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;

describe.runIf(run)('contract with Zitadel and samples/Sagas', () => {
  it('discovers the real Zitadel and sends the authorization request to its endpoint', async () => {
    const navigations: string[] = [];
    const oidc = createOidc(
      zitadel({
        issuer,
        clientId: 'not-registered-until-BC-9',
        projectId: project(),
        redirectUri: 'http://localhost:5173/callback',
        allowHttp: true,
        storage: memoryStorage(),
        navigate: (u) => navigations.push(u),
      }),
    );
    await oidc.login('/');
    const url = new URL(navigations[0] ?? '');
    expect(url.href.startsWith(`${issuer}/oauth/v2/authorize?`)).toBe(true);
    expect(url.searchParams.get('scope')).toContain(`urn:zitadel:iam:org:project:id:${project()}:aud`);
    // Zitadel answers the request (a login page or an error page for the unknown client), never a server error
    const page = await fetch(url, { redirect: 'manual' });
    expect(page.status).toBeLessThan(500);
  });

  it('reads the roles the backend enforces from real tokens', async () => {
    const [alice, bob] = await Promise.all([accessToken('alice'), accessToken('bob')]);
    const a = await zitadelClaims(payload(alice), project());
    const b = await zitadelClaims(payload(bob), project());
    expect(a.roles).toContain('tarol-admin');
    expect(b.roles).not.toContain('tarol-admin');
    const admin = async (token: string): Promise<number> =>
      (await fetch(`${api}/tarol/admin/projections`, { headers: { authorization: `Bearer ${token}` } })).status;
    expect(await admin(alice)).toBe(200);
    expect(await admin(bob)).toBe(403);
  });

  it('derives the tenant from the organisation claim of a real token', async () => {
    const claims = payload(await accessToken('alice'));
    const organisation = claims['urn:zitadel:iam:user:resourceowner:id'];
    expect(typeof organisation).toBe('string');
    const mapped = await zitadelClaims(claims, project());
    expect(mapped.tenant).toBe(await zitadelTenant(String(organisation)));
    expect(mapped.tenant).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
