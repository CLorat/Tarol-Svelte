import type { TokenProvider } from '@clorat/tarol-client';
import * as oauth from 'oauth4webapi';

/** The part of `Storage` the login needs between the redirect and its callback; `sessionStorage` by default. */
export type OidcStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** What the app reads from the ID token's claims: the tenant and the roles. The Zitadel preset supplies one. */
export interface OidcClaimsMapping {
  /** The tenant the backend derives from the same token; part of the client's cache keys. */
  readonly tenant: string | null;
  /** The roles the backend grants, for role-dependent actions in the UI. */
  readonly roles: readonly string[];
}

/** Settings of `createOidc`. */
export interface OidcOptions {
  /** The issuer identifier, e.g. `https://auth.example.com`; its `/.well-known/openid-configuration` is read once. */
  readonly issuer: string;
  /** The public client (a user-agent app, no secret). */
  readonly clientId: string;
  /** The registered redirect URI the authorization server sends the code to. */
  readonly redirectUri: string;
  /** Where the end-session endpoint returns to; omitted when the server's default is wanted. */
  readonly postLogoutRedirectUri?: string | undefined;
  /** The scopes; `openid` is always sent. Ask for `offline_access` to get a refresh token. */
  readonly scopes?: readonly string[] | undefined;
  /** Maps the ID token's claims to tenant and roles. Default: the `tenant` claim and the `roles` array claim. */
  readonly claims?:
    ((claims: Readonly<Record<string, unknown>>) => OidcClaimsMapping | Promise<OidcClaimsMapping>) | undefined;
  /** Allows `http:` issuers, for a local authorization server only. Default `false`. */
  readonly allowHttp?: boolean | undefined;
  /** Defaults to `globalThis.fetch`, taken at call time. */
  readonly fetch?: typeof fetch | undefined;
  /** Holds the PKCE verifier, state and nonce during the redirect only. Default `sessionStorage`. */
  readonly storage?: OidcStorage | undefined;
  /** Opens a URL in this window (login, restore, logout). Default `location.assign`. */
  readonly navigate?: ((url: string) => void) | undefined;
  /** Replaces the callback URL after it was handled, so a reload does not repeat it. Default `history.replaceState`. */
  readonly replaceUrl?: ((url: string) => void) | undefined;
  /** Called after logout and after a refresh that failed, e.g. `() => client.invalidate()`. */
  readonly onSignOut?: (() => void) | undefined;
  /** Whether the browser is online. Default `navigator.onLine` (`true` outside a browser). */
  readonly online?: (() => boolean) | undefined;
  /**
   * Remember the last signed-in person (subject, tenant, roles; never a token) for an app opened offline: `true` keeps it
   * in `localStorage`, or pass a storage. Forgotten by `logout()`. Default: not remembered.
   */
  readonly lastSession?: boolean | OidcStorage | undefined;
}

/** The person who signed in last on this device ({@link OidcOptions.lastSession}); no tokens. */
export interface LastSession {
  /** The `sub` claim. */
  readonly subject: string;
  /** The tenant, as the backend derives it. */
  readonly tenant: string | null;
  /** The roles granted at that sign-in. */
  readonly roles: readonly string[];
  /** When that sign-in (or its last refresh) happened, in milliseconds since the epoch. */
  readonly signedInAt: number;
}

/** The outcome of {@link Oidc.restore}. */
export type RestoreResult =
  /** The browser is on its way to the authorization server (`prompt=none`). */
  | 'redirected'
  /** Offline, or the authorization server cannot be reached: nothing happened (no browser error page). */
  | 'offline';

/** The signed-in user, from the ID token (philosophy P5: auth is handled once). */
export interface OidcSession {
  /** The `sub` claim. */
  readonly subject: string;
  /** The tenant, as the backend derives it. */
  readonly tenant: string | null;
  /** The roles granted to the user. */
  readonly roles: readonly string[];
  /** All validated ID token claims. */
  readonly claims: Readonly<Record<string, unknown>>;
  /** How the user signed in: the ID token's `amr` values (`pwd`, `otp`, `mfa` …), or none when it has no `amr`. */
  readonly factors: readonly string[];
  /** When the access token expires, in milliseconds since the epoch. */
  readonly expiresAt: number;
}

/** Settings of one {@link Oidc.login}: a stronger or a fresh sign-in (step-up). */
export interface LoginOptions {
  /** The path to return to after the callback. Default: the current path. */
  readonly returnTo?: string | undefined;
  /** The authentication context classes to ask for (`acr_values`), most wanted first. */
  readonly acr?: string | readonly string[] | undefined;
  /**
   * The oldest sign-in accepted, in seconds (`max_age`): the server asks again when its session is older, and the
   * callback refuses an ID token whose `auth_time` is older.
   */
  readonly maxAge?: number | undefined;
  /** `login` asks for the credentials again, `select_account` lets the user choose an account, `consent` asks again. */
  readonly prompt?: 'login' | 'select_account' | 'consent' | undefined;
}

/** The outcome of {@link Oidc.handleRedirect}. */
export type RedirectResult =
  /** The URL is not a callback of this client: nothing was done. */
  | { readonly kind: 'none' }
  /** Tokens were received; `returnTo` is the path the login started from. */
  | { readonly kind: 'signed-in'; readonly returnTo: string }
  /** The server refused (`login_required` after {@link Oidc.restore}, `access_denied`, …) or the callback was invalid. */
  | { readonly kind: 'signed-out'; readonly returnTo: string; readonly error: string };

/** A login for a browser SPA: authorization code with PKCE, tokens in memory only (SV-7). */
export interface Oidc {
  /** Pass it to `createClient({ tokens })` and `connectPush({ tokens })`. */
  readonly provider: TokenProvider;
  /** The current session, or `null` when signed out. */
  session(): OidcSession | null;
  /** Calls `listener` on every sign-in, refresh and sign-out; returns the unsubscribe function. */
  subscribe(listener: (session: OidcSession | null) => void): () => void;
  /**
   * Redirects to the authorization server; `returnTo` (default: the current path) is restored after the callback. With
   * {@link LoginOptions} it asks for a stronger or a fresh sign-in (`acr`, `maxAge`, `prompt`).
   */
  login(returnTo?: string | LoginOptions): Promise<void>;
  /**
   * After a reload (no tokens in memory): a top-level `prompt=none` redirect that the server's session answers. Offline, or
   * when the authorization server cannot be reached, it does not navigate and resolves `'offline'`.
   */
  restore(returnTo?: string): Promise<RestoreResult>;
  /** The person who signed in last on this device (option `lastSession`), or `null`; for an app opened offline. */
  lastSession(): LastSession | null;
  /** Handles the callback URL (default `location.href`); call it once at start-up. */
  handleRedirect(url?: string): Promise<RedirectResult>;
  /** Forgets the tokens and redirects to the end-session endpoint (when the server has one). */
  logout(): Promise<void>;
}

/** The share of the token's lifetime after which it is refreshed ahead of time. */
const refreshAt = 0.8;
const pendingKey = 'tarol-oidc:';
const lastKey = 'tarol-oidc-last';

interface Pending {
  readonly verifier: string;
  readonly nonce: string;
  readonly returnTo: string;
  readonly maxAge?: number;
}

interface Tokens {
  readonly access: string;
  readonly refresh: string | undefined;
  readonly idToken: string | undefined;
  readonly session: OidcSession;
}

const defaultClaims = (claims: Readonly<Record<string, unknown>>): OidcClaimsMapping => ({
  tenant: typeof claims['tenant'] === 'string' ? claims['tenant'] : null,
  roles: Array.isArray(claims['roles']) ? claims['roles'].filter((r): r is string => typeof r === 'string') : [],
});

const here = (): string => `${location.pathname}${location.search}${location.hash}`;

/** Creates the login. Nothing is requested until {@link Oidc.login}, {@link Oidc.restore} or {@link Oidc.handleRedirect}. */
export function createOidc(options: OidcOptions): Oidc {
  const issuer = new URL(options.issuer);
  const client: oauth.Client = { client_id: options.clientId };
  const auth = oauth.None();
  // oauth4webapi passes method, headers, body, redirect and signal: a subset of RequestInit
  const http = <M extends string, B extends BodyInit | undefined>(): oauth.HttpRequestOptions<M, B> => ({
    [oauth.customFetch]: (url, init) => (options.fetch ?? globalThis.fetch)(url, init as RequestInit),
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- deprecated as a marker only; opt-in for a local http issuer (oidc.md §6)
    [oauth.allowInsecureRequests]: options.allowHttp === true,
  });
  const storage = (): OidcStorage => options.storage ?? sessionStorage;
  const navigate = (url: string): void => {
    if (options.navigate) options.navigate(url);
    else location.assign(url);
  };
  const scope = [...new Set(['openid', ...(options.scopes ?? [])])].join(' ');
  const online = options.online ?? ((): boolean => (globalThis.navigator as Navigator | undefined)?.onLine !== false);
  const remembered = (): OidcStorage | undefined =>
    options.lastSession === true ? localStorage : options.lastSession === false ? undefined : options.lastSession;
  const remember = (session: OidcSession | null): void => {
    const store = remembered();
    if (!store) return;
    try {
      if (session) {
        const last: LastSession = {
          subject: session.subject,
          tenant: session.tenant,
          roles: session.roles,
          signedInAt: Date.now(),
        };
        store.setItem(lastKey, JSON.stringify(last));
      } else store.removeItem(lastKey);
    } catch {
      // a blocked storage: nothing remembered
    }
  };
  const listeners = new Set<(session: OidcSession | null) => void>();
  let server: Promise<oauth.AuthorizationServer> | undefined;
  let tokens: Tokens | null = null;
  let refreshing: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const discover = (): Promise<oauth.AuthorizationServer> => {
    server ??= oauth
      .discoveryRequest(issuer, { algorithm: 'oidc', ...http() })
      .then((r) => oauth.processDiscoveryResponse(issuer, r))
      .catch((e: unknown) => {
        server = undefined; // a failed discovery is tried again by the next call
        throw e;
      });
    return server;
  };

  const set = (next: Tokens | null): void => {
    clearTimeout(timer);
    tokens = next;
    if (next) remember(next.session);
    if (next) {
      const lifetime = next.session.expiresAt - Date.now();
      // a network failure here is not the end of the session: the next token() or 401 tries again
      if (next.refresh) timer = setTimeout(() => void refresh().catch(() => false), Math.max(0, lifetime * refreshAt));
    }
    for (const l of listeners) l(next?.session ?? null);
  };

  const accept = async (r: oauth.TokenEndpointResponse, previous: Tokens | null): Promise<Tokens> => {
    // a refresh response may omit the ID token; the claims of the login stay valid then
    const claims: Readonly<Record<string, unknown>> =
      oauth.getValidatedIdTokenClaims(r) ?? previous?.session.claims ?? {};
    const mapped = await (options.claims ?? defaultClaims)(claims);
    return {
      access: r.access_token,
      refresh: r.refresh_token ?? previous?.refresh,
      idToken: r.id_token ?? previous?.idToken,
      session: {
        subject: typeof claims['sub'] === 'string' ? claims['sub'] : '',
        tenant: mapped.tenant,
        roles: mapped.roles,
        claims,
        factors: Array.isArray(claims['amr']) ? claims['amr'].filter((f): f is string => typeof f === 'string') : [],
        expiresAt: Date.now() + (r.expires_in ?? 300) * 1000,
      },
    };
  };

  const signOut = (): void => {
    set(null);
    options.onSignOut?.();
  };

  // concurrent callers (a 401 on several requests, the timer) share one refresh: a rotated refresh token is single-use
  const refresh = (): Promise<boolean> => {
    refreshing ??= (async () => {
      const current = tokens;
      if (!current?.refresh) return false;
      try {
        const as = await discover();
        const response = await oauth.refreshTokenGrantRequest(as, client, auth, current.refresh, http());
        const result = await oauth.processRefreshTokenResponse(as, client, response);
        if (tokens !== current) return tokens !== null; // signed out or in again meanwhile
        set(await accept(result, current));
        return true;
      } catch (e) {
        // the server refused the refresh token (revoked, expired, reused): the session is over
        if (e instanceof oauth.ResponseBodyError) {
          if (tokens === current) signOut();
          return false;
        }
        throw e;
      }
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const redirect = async (returnTo: string, prompt: string | undefined, extra: LoginOptions = {}): Promise<void> => {
    const as = await discover();
    if (!as.authorization_endpoint) throw new Error('tarol-oidc: the server has no authorization_endpoint');
    const verifier = oauth.generateRandomCodeVerifier();
    const state = oauth.generateRandomState();
    const nonce = oauth.generateRandomNonce();
    const pending: Pending = {
      verifier,
      nonce,
      returnTo,
      ...(extra.maxAge === undefined ? {} : { maxAge: extra.maxAge }),
    };
    storage().setItem(pendingKey + state, JSON.stringify(pending));
    const url = new URL(as.authorization_endpoint);
    const query = url.searchParams;
    query.set('client_id', options.clientId);
    query.set('redirect_uri', options.redirectUri);
    query.set('response_type', 'code');
    query.set('scope', scope);
    query.set('state', state);
    query.set('nonce', nonce);
    query.set('code_challenge', await oauth.calculatePKCECodeChallenge(verifier));
    query.set('code_challenge_method', 'S256');
    if (prompt) query.set('prompt', prompt);
    const acr = typeof extra.acr === 'string' ? [extra.acr] : (extra.acr ?? []);
    if (acr.length > 0) query.set('acr_values', acr.join(' '));
    if (extra.maxAge !== undefined) query.set('max_age', String(extra.maxAge));
    navigate(url.href);
  };

  const handleRedirect = async (href?: string): Promise<RedirectResult> => {
    const url = new URL(href ?? location.href);
    const state = url.searchParams.get('state');
    const base = new URL(options.redirectUri);
    if (url.origin !== base.origin || url.pathname !== base.pathname || state === null) return { kind: 'none' };
    if (!url.searchParams.has('code') && !url.searchParams.has('error')) return { kind: 'none' };
    // single use: the verifier, state and nonce leave storage before anything else happens
    const raw = storage().getItem(pendingKey + state);
    storage().removeItem(pendingKey + state);
    const pending = raw ? (JSON.parse(raw) as Pending) : null;
    const returnTo = pending?.returnTo ?? '/';
    if (options.replaceUrl) options.replaceUrl(returnTo);
    else history.replaceState(history.state, '', returnTo);
    if (!pending) return { kind: 'signed-out', returnTo, error: 'state_mismatch' };
    const as = await discover();
    try {
      const parameters = oauth.validateAuthResponse(as, client, url, state);
      const response = await oauth.authorizationCodeGrantRequest(
        as,
        client,
        auth,
        parameters,
        options.redirectUri,
        pending.verifier,
        http(),
      );
      const result = await oauth.processAuthorizationCodeResponse(as, client, response, {
        expectedNonce: pending.nonce,
        requireIdToken: true,
        ...(pending.maxAge === undefined ? {} : { maxAge: pending.maxAge }),
      });
      set(await accept(result, null));
      return { kind: 'signed-in', returnTo };
    } catch (e) {
      if (e instanceof oauth.AuthorizationResponseError || e instanceof oauth.ResponseBodyError)
        return { kind: 'signed-out', returnTo, error: e.error };
      if (e instanceof oauth.OperationProcessingError)
        return { kind: 'signed-out', returnTo, error: 'invalid_response' };
      throw e;
    }
  };

  const logout = async (): Promise<void> => {
    const idToken = tokens?.idToken;
    signOut();
    remember(null); // an explicit sign-out forgets the person too
    const as = await discover();
    if (!as.end_session_endpoint) return;
    const url = new URL(as.end_session_endpoint);
    url.searchParams.set('client_id', options.clientId);
    if (idToken) url.searchParams.set('id_token_hint', idToken);
    if (options.postLogoutRedirectUri) url.searchParams.set('post_logout_redirect_uri', options.postLogoutRedirectUri);
    navigate(url.href);
  };

  const provider: TokenProvider = {
    async token() {
      const current = tokens;
      if (!current) return null;
      if (Date.now() < current.session.expiresAt) return current.access;
      // expired (a throttled background tab missed the timer): refresh first, or report signed out
      if (await refresh()) return tokens?.access ?? null;
      if (tokens === current) signOut(); // no refresh token: the session ended with its access token
      return null;
    },
    tenant: () => tokens?.session.tenant ?? null,
    refresh,
  };

  return {
    provider,
    session: () => tokens?.session ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    login: (to) =>
      typeof to === 'object' ? redirect(to.returnTo ?? here(), to.prompt, to) : redirect(to ?? here(), undefined),
    async restore(returnTo) {
      if (!online()) return 'offline';
      let as: oauth.AuthorizationServer;
      try {
        as = await discover();
        // the metadata may come from a cache (a service worker): check that the server answers before leaving the page
        if (as.authorization_endpoint)
          await (options.fetch ?? globalThis.fetch)(as.authorization_endpoint, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store',
          });
      } catch (e) {
        if (e instanceof TypeError) return 'offline'; // fetch failed: no network or no server
        throw e;
      }
      await redirect(returnTo ?? here(), 'none');
      return 'redirected';
    },
    lastSession() {
      try {
        const raw = remembered()?.getItem(lastKey);
        return raw ? (JSON.parse(raw) as LastSession) : null;
      } catch {
        return null;
      }
    },
    handleRedirect,
    logout,
  };
}
