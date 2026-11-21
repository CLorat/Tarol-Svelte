// Contract test against the real sample (Tarol-Net samples/Sagas: Zitadel v4.20.3 on :8080, the API on :5080). Runs only
// with TAROL_E2E=1, like the client's. The browser login runs for real: the sample's PKCE app artflow-web (web.txt) and a
// human user (users.txt, passwords generated per run); Chromium fills Zitadel's own login page while the client under
// test runs the code + PKCE flow, the refresh and the backend calls here. It also checks that the preset reads real
// Zitadel tokens the way the backend does (the roles the backend enforces).
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { createOidc } from '../src/index.js';
import { zitadel, zitadelClaims, zitadelTenant } from '../src/zitadel.js';
import { memoryStorage } from './fake-server.js';

const run = process.env['TAROL_E2E'] === '1';
const api = process.env['TAROL_E2E_URL'] ?? 'http://localhost:5080';
const issuer = process.env['TAROL_E2E_ISSUER'] ?? 'http://localhost:8080';
const zitadelDir = process.env['TAROL_E2E_ZITADEL'] ?? join(tmpdir(), 'artflow-zitadel');
const project = (): string => readFileSync(join(zitadelDir, 'project.txt'), 'utf8').trim();
const webClient = (): string => readFileSync(join(zitadelDir, 'web.txt'), 'utf8').trim().split(' ')[1] ?? '';
const password = (login: string): string =>
  readFileSync(join(zitadelDir, 'users.txt'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`user ${login} `))
    ?.split(' ')[2] ?? '';

/** Signs a human user in on Zitadel's login page in Chromium; returns the callback URL the browser was sent to. */
async function browserLogin(authorize: string, login: string): Promise<string> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // the callback goes to the app's origin, which does not run here: catch the request instead of the page
    const callback = new Promise<string>((resolve) => {
      page.on('request', (r) => {
        if (r.url().startsWith('http://localhost:5173/')) resolve(r.url());
      });
    });
    await page.goto(authorize);
    await page.locator('#loginName').fill(login);
    await page.locator('#submit-button').click();
    await page.locator('#password').fill(password(login));
    await page.locator('#submit-button').click();
    return await callback;
  } finally {
    await browser.close();
  }
}

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
  it('signs a human user in with code + PKCE, calls the backend with the token and refreshes it', async () => {
    const navigations: string[] = [];
    const oidc = createOidc(
      zitadel({
        issuer,
        clientId: webClient(),
        projectId: project(),
        redirectUri: 'http://localhost:5173/',
        allowHttp: true,
        storage: memoryStorage(),
        navigate: (u) => navigations.push(u),
        replaceUrl: () => undefined,
      }),
    );
    await oidc.login('/#/auctions');
    const callback = await browserLogin(navigations[0] ?? '', 'ada');
    expect(await oidc.handleRedirect(callback)).toEqual({ kind: 'signed-in', returnTo: '/#/auctions' });
    const session = oidc.session();
    expect(session?.roles).toEqual(expect.arrayContaining(['seller', 'tarol-admin']));
    const call = async (path: string): Promise<number> =>
      (await fetch(`${api}${path}`, { headers: { authorization: `Bearer ${(await oidc.provider.token()) ?? ''}` } }))
        .status;
    expect(await call('/auctions?limit=1')).toBe(200);
    expect(await call('/tarol/admin/projections')).toBe(200); // ada is tarol-admin
    const first = await oidc.provider.token();
    expect(await oidc.provider.refresh?.()).toBe(true); // offline_access gave a refresh token
    expect(await oidc.provider.token()).not.toBe(first);
    expect(await call('/auctions?limit=1')).toBe(200);
  });

  it('gives a bidder no admin rights', async () => {
    const navigations: string[] = [];
    const oidc = createOidc(
      zitadel({
        issuer,
        clientId: webClient(),
        projectId: project(),
        redirectUri: 'http://localhost:5173/',
        allowHttp: true,
        storage: memoryStorage(),
        navigate: (u) => navigations.push(u),
        replaceUrl: () => undefined,
      }),
    );
    await oidc.login('/');
    expect((await oidc.handleRedirect(await browserLogin(navigations[0] ?? '', 'ben'))).kind).toBe('signed-in');
    expect(oidc.session()?.roles).toEqual(['bidder']);
    const status = (
      await fetch(`${api}/tarol/admin/projections`, {
        headers: { authorization: `Bearer ${(await oidc.provider.token()) ?? ''}` },
      })
    ).status;
    expect(status).toBe(403);
  });

  it('discovers the real Zitadel and sends the authorization request to its login page', async () => {
    const navigations: string[] = [];
    const oidc = createOidc(
      zitadel({
        issuer,
        clientId: webClient(),
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
    // the request ends on Zitadel's login page (BC-18: it ended on a 404 while the sample required login v2)
    const page = await fetch(url);
    expect(page.status).toBe(200);
    expect(new URL(page.url).pathname).toBe('/ui/login/login');
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
