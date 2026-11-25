import { createClient } from '@clorat/tarol-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOidc, type OidcOptions } from '../src/index.js';
import { fakeServer, memoryStorage, type FakeServer } from './fake-server.js';

const app = 'https://app.example.com';

function setup(extra: Partial<OidcOptions> = {}) {
  const server = fakeServer();
  const storage = memoryStorage();
  const navigations: string[] = [];
  const replaced: string[] = [];
  const signOuts = vi.fn();
  const oidc = createOidc({
    issuer: server.issuer,
    clientId: 'spa',
    redirectUri: `${app}/callback`,
    postLogoutRedirectUri: `${app}/`,
    scopes: ['offline_access'],
    fetch: server.fetch,
    storage,
    navigate: (u) => navigations.push(u),
    replaceUrl: (u) => replaced.push(u),
    onSignOut: signOuts,
    ...extra,
  });
  const signIn = async (s: FakeServer = server, returnTo = '/auctions?page=2') => {
    await oidc.login(returnTo);
    return oidc.handleRedirect(s.authorize(navigations.at(-1) ?? ''));
  };
  return { server, storage, navigations, replaced, signOuts, oidc, signIn };
}

describe('login', () => {
  it('redirects with code + PKCE (S256), state, nonce and the scopes', async () => {
    const { oidc, navigations, storage } = setup();
    await oidc.login('/auctions');
    const url = new URL(navigations[0] ?? '');
    expect(url.origin + url.pathname).toBe('https://auth.example.com/authorize');
    const q = url.searchParams;
    expect(q.get('response_type')).toBe('code');
    expect(q.get('client_id')).toBe('spa');
    expect(q.get('redirect_uri')).toBe(`${app}/callback`);
    expect(q.get('scope')).toBe('openid offline_access');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    expect(q.get('state')).toMatch(/^[\w-]{43}$/);
    expect(q.get('nonce')).toMatch(/^[\w-]{43}$/);
    expect(q.has('prompt')).toBe(false);
    // only the pending login is stored, under its state; never a token
    expect([...storage.entries.keys()]).toEqual([`tarol-oidc:${q.get('state') ?? ''}`]);
  });

  it('exchanges the code, keeps the tokens in memory and removes the pending entry', async () => {
    const { oidc, signIn, storage, replaced, server } = setup();
    const seen: unknown[] = [];
    oidc.subscribe((s) => seen.push(s?.subject ?? null));
    const result = await signIn();
    expect(result).toEqual({ kind: 'signed-in', returnTo: '/auctions?page=2' });
    expect(replaced).toEqual(['/auctions?page=2']);
    expect(storage.entries.size).toBe(0);
    expect(server.tokenRequests[0]?.get('code_verifier')).toMatch(/^[\w-]{43}$/);
    expect(await oidc.provider.token()).toBe('access-2');
    expect(oidc.session()?.subject).toBe('user-1');
    expect(seen).toEqual(['user-1']);
  });

  it('reads tenant and roles from the default claims', async () => {
    const { oidc, signIn, server } = setup();
    server.claims = { tenant: 't-1', roles: ['clerk', 42] };
    await signIn();
    expect(oidc.provider.tenant()).toBe('t-1');
    expect(oidc.session()?.roles).toEqual(['clerk']);
  });

  it('refuses a callback whose state it did not issue, without a token request', async () => {
    const { oidc, server } = setup();
    const result = await oidc.handleRedirect(`${app}/callback?code=x&state=forged`);
    expect(result).toEqual({ kind: 'signed-out', returnTo: '/', error: 'state_mismatch' });
    expect(server.tokenRequests).toHaveLength(0);
    expect(oidc.session()).toBeNull();
  });

  it('cannot replay a callback: the verifier is single-use', async () => {
    const { oidc, navigations, server } = setup();
    await oidc.login('/');
    const callback = server.authorize(navigations[0] ?? '');
    expect((await oidc.handleRedirect(callback)).kind).toBe('signed-in');
    expect(await oidc.handleRedirect(callback)).toMatchObject({ kind: 'signed-out', error: 'state_mismatch' });
  });

  it('ignores URLs that are not its callback', async () => {
    const { oidc } = setup();
    expect(await oidc.handleRedirect(`${app}/auctions?state=1&code=2`)).toEqual({ kind: 'none' });
    expect(await oidc.handleRedirect(`${app}/callback`)).toEqual({ kind: 'none' });
  });

  it('reports a code the server refuses', async () => {
    const { oidc, navigations, server } = setup();
    await oidc.login('/');
    const callback = new URL(server.authorize(navigations[0] ?? ''));
    callback.searchParams.set('code', 'unknown');
    expect(await oidc.handleRedirect(callback.href)).toMatchObject({ kind: 'signed-out', error: 'invalid_grant' });
  });
});

describe('restore', () => {
  it('redirects with prompt=none and reports login_required without a loop', async () => {
    const { oidc, navigations, server } = setup();
    await oidc.restore('/bids');
    const url = navigations[0] ?? '';
    expect(new URL(url).searchParams.get('prompt')).toBe('none');
    const result = await oidc.handleRedirect(server.authorize(url));
    expect(result).toEqual({ kind: 'signed-out', returnTo: '/bids', error: 'login_required' });
    expect(navigations).toHaveLength(1);
  });

  it('reads the server metadata once', async () => {
    const { oidc, server, signIn } = setup();
    await signIn();
    await oidc.restore('/');
    expect(server.discoveries).toBe(1);
  });
});

describe('refresh', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-11-19T10:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  it('refreshes at 80 % of the lifetime and rotates the refresh token', async () => {
    const { oidc, signIn, server } = setup();
    await signIn();
    const first = server.tokenRequests.length;
    await vi.advanceTimersByTimeAsync(79_000);
    expect(server.tokenRequests).toHaveLength(first);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(server.tokenRequests).toHaveLength(first + 1);
    expect(server.tokenRequests[first]?.get('refresh_token')).toBe('refresh-2');
    expect(await oidc.provider.token()).toBe('access-3');
    await vi.advanceTimersByTimeAsync(80_000);
    expect(server.tokenRequests[first + 1]?.get('refresh_token')).toBe('refresh-3');
    expect(await oidc.provider.token()).toBe('access-4');
  });

  it('coalesces concurrent refreshes into one request', async () => {
    const { oidc, signIn, server } = setup();
    await signIn();
    let open!: () => void;
    server.gate = new Promise((r) => (open = r));
    const refresh = oidc.provider.refresh?.bind(oidc.provider) ?? (() => Promise.resolve(false));
    const calls = [refresh(), refresh(), refresh()];
    await vi.advanceTimersByTimeAsync(0);
    open();
    expect(await Promise.all(calls)).toEqual([true, true, true]);
    expect(server.tokenRequests.filter((r) => r.get('grant_type') === 'refresh_token')).toHaveLength(1);
  });

  it('ends the session when the server refuses the refresh token', async () => {
    const { oidc, signIn, server, signOuts } = setup();
    await signIn();
    server.refuseRefresh = 'invalid_grant';
    expect(await oidc.provider.refresh?.()).toBe(false);
    expect(oidc.session()).toBeNull();
    expect(await oidc.provider.token()).toBeNull();
    expect(signOuts).toHaveBeenCalledOnce();
  });

  it('refreshes an expired token before handing it out (a throttled tab missed the timer)', async () => {
    const { oidc, signIn, server } = setup();
    await signIn();
    vi.setSystemTime(Date.now() + 200_000); // past expiry, the timer has not fired
    expect(await oidc.provider.token()).toBe('access-3');
    expect(server.tokenRequests.at(-1)?.get('grant_type')).toBe('refresh_token');
  });

  it('ends the session at expiry when there is no refresh token', async () => {
    const { oidc, signIn, server, signOuts } = setup();
    server.issueRefresh = false;
    await signIn();
    vi.setSystemTime(Date.now() + 101_000);
    expect(await oidc.provider.token()).toBeNull();
    expect(oidc.session()).toBeNull();
    expect(signOuts).toHaveBeenCalledOnce();
  });

  it('repeats a request once after a 401, through the client', async () => {
    const { oidc, signIn, server } = setup();
    await signIn();
    const seen: (string | null)[] = [];
    const api: typeof fetch = (_input, init) => {
      const auth = new Headers(init?.headers).get('authorization');
      seen.push(auth);
      return Promise.resolve(
        auth === 'Bearer access-2'
          ? new Response(null, { status: 401, headers: { 'www-authenticate': 'Bearer' } })
          : new Response(JSON.stringify({ id: 'a' }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    };
    const client = createClient({ baseUrl: 'https://api.example.com', tokens: oidc.provider, fetch: api });
    const result = await client.read('/auctions/a');
    expect(result.ok).toBe(true);
    expect(seen).toEqual(['Bearer access-2', 'Bearer access-3']);
    expect(server.tokenRequests.at(-1)?.get('grant_type')).toBe('refresh_token');
  });
});

describe('logout', () => {
  it('forgets the tokens and redirects to the end-session endpoint with the ID token hint', async () => {
    const { oidc, signIn, navigations, signOuts } = setup();
    await signIn();
    await oidc.logout();
    expect(oidc.session()).toBeNull();
    expect(await oidc.provider.token()).toBeNull();
    expect(signOuts).toHaveBeenCalledOnce();
    const url = new URL(navigations.at(-1) ?? '');
    expect(url.origin + url.pathname).toBe('https://auth.example.com/logout');
    expect(url.searchParams.get('client_id')).toBe('spa');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(`${app}/`);
    expect(url.searchParams.get('id_token_hint')?.split('.')).toHaveLength(3);
  });

  it('stops the refresh timer', async () => {
    vi.useFakeTimers();
    try {
      const { oidc, signIn, server } = setup();
      await signIn();
      await oidc.logout();
      const count = server.tokenRequests.length;
      await vi.advanceTimersByTimeAsync(200_000);
      expect(server.tokenRequests).toHaveLength(count);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('transport', () => {
  it('refuses an http issuer unless allowed', async () => {
    const server = fakeServer('http://localhost:8080');
    const base = {
      issuer: server.issuer,
      clientId: 'spa',
      redirectUri: `${app}/callback`,
      fetch: server.fetch,
      storage: memoryStorage(),
      navigate: () => undefined,
    };
    await expect(createOidc(base).login('/')).rejects.toThrow(/http/i);
    await expect(createOidc({ ...base, allowHttp: true }).login('/')).resolves.toBeUndefined();
  });
});

describe('an offline PWA (TS-23, Tatalu FB-F17.3-4)', () => {
  it('restore() does not navigate when the browser is offline, and says so', async () => {
    const { oidc, navigations } = setup({ online: () => false });
    expect(await oidc.restore('/today')).toBe('offline');
    expect(navigations).toHaveLength(0);
  });

  it('restore() does not navigate when the authorization server cannot be reached', async () => {
    const server = fakeServer();
    let reachable = true;
    const { oidc, navigations } = setup({
      fetch: (input, init) =>
        reachable ? server.fetch(input, init) : Promise.reject(new TypeError('Failed to fetch')),
    });
    reachable = false; // discovery fails: the page was opened from the cache, the network is gone
    expect(await oidc.restore('/today')).toBe('offline');
    reachable = true;
    expect(await oidc.restore('/today')).toBe('redirected');
    expect(navigations).toHaveLength(1);
  });

  it('remembers the last signed-in person without tokens (opt-in) and forgets it on logout', async () => {
    const remembered = memoryStorage();
    const { oidc, signIn, server } = setup({ lastSession: remembered });
    server.claims = { tenant: 't-1', roles: ['carer'] };
    expect(oidc.lastSession()).toBeNull();
    await signIn();
    const last = oidc.lastSession();
    expect(last).toMatchObject({ subject: 'user-1', tenant: 't-1', roles: ['carer'] });
    expect(typeof last?.signedInAt).toBe('number');
    const stored = [...remembered.entries.values()].join();
    expect(stored).not.toContain('access-');
    expect(stored).not.toContain('refresh-');
    // a new page (reload, offline): the tokens are gone, the person is not
    const again = createOidc({
      issuer: server.issuer,
      clientId: 'spa',
      redirectUri: `${app}/callback`,
      fetch: server.fetch,
      storage: memoryStorage(),
      navigate: () => undefined,
      lastSession: remembered,
    });
    expect(again.session()).toBeNull();
    expect(again.lastSession()?.subject).toBe('user-1');
    await oidc.logout();
    expect(oidc.lastSession()).toBeNull();
    expect(setup().oidc.lastSession()).toBeNull(); // off by default
  });
});

describe('a stronger sign-in (TS-24, Tatalu FB-F13.2-1)', () => {
  it('login({ acr, maxAge, prompt }) asks for it, and the callback checks auth_time against maxAge', async () => {
    const { oidc, navigations, server } = setup();
    await oidc.login({ returnTo: '/finances', acr: ['mfa', 'urn:example:loa:2'], maxAge: 300, prompt: 'login' });
    const q = new URL(navigations[0] ?? '').searchParams;
    expect(q.get('acr_values')).toBe('mfa urn:example:loa:2');
    expect(q.get('max_age')).toBe('300');
    expect(q.get('prompt')).toBe('login');
    server.claims = { auth_time: Math.floor(Date.now() / 1000) - 600 }; // signed in 10 minutes ago: too old
    expect(await oidc.handleRedirect(server.authorize(navigations[0] ?? ''))).toMatchObject({
      kind: 'signed-out',
      returnTo: '/finances',
    });
    await oidc.login({ returnTo: '/finances', maxAge: 300 });
    server.claims = { auth_time: Math.floor(Date.now() / 1000), amr: ['pwd', 'otp', 7] };
    expect(await oidc.handleRedirect(server.authorize(navigations[1] ?? ''))).toEqual({
      kind: 'signed-in',
      returnTo: '/finances',
    });
  });

  it('gives the factors of the sign-in (amr) on the session', async () => {
    const { oidc, signIn, server } = setup();
    server.claims = { amr: ['pwd', 'otp', 7] };
    await signIn();
    expect(oidc.session()?.factors).toEqual(['pwd', 'otp']);
    server.claims = {};
    await signIn();
    expect(oidc.session()?.factors).toEqual([]);
  });
});

describe('revoke (TS-25, Tatalu FB-F13.2-2)', () => {
  it('revokes the refresh token at the server, signs out here and does not navigate', async () => {
    const { oidc, signIn, server, navigations, signOuts } = setup({ lastSession: memoryStorage() });
    await signIn();
    const before = navigations.length;
    const refresh = server.tokenRequests.length;
    expect(await oidc.revoke()).toBe(true);
    expect(server.revocations).toHaveLength(1);
    expect(server.revocations[0]?.get('token')).toMatch(/^refresh-/);
    expect(server.revocations[0]?.get('token_type_hint')).toBe('refresh_token');
    expect(oidc.session()).toBeNull();
    expect(oidc.lastSession()).toBeNull();
    expect(signOuts).toHaveBeenCalledTimes(1);
    expect(navigations).toHaveLength(before);
    expect(server.tokenRequests).toHaveLength(refresh);
  });

  it('signs out here and reports false when there is nothing to revoke', async () => {
    const { oidc, signIn, server } = setup();
    server.issueRefresh = false;
    await signIn();
    expect(await oidc.revoke()).toBe(false);
    expect(server.revocations).toHaveLength(0);
    expect(oidc.session()).toBeNull();
  });
});
