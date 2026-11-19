import { createHash } from 'node:crypto';

/** A fake OIDC authorization server behind a `fetch`: discovery, the token endpoint (code + PKCE, refresh rotation). */
export interface FakeServer {
  readonly issuer: string;
  readonly fetch: typeof fetch;
  /** Every token endpoint request body, in order. */
  readonly tokenRequests: URLSearchParams[];
  /** How many discovery documents were served. */
  discoveries: number;
  /** Lifetime of issued access tokens in seconds. */
  expiresIn: number;
  /** Claims added to every ID token. */
  claims: Record<string, unknown>;
  /** Whether refresh tokens are issued. */
  issueRefresh: boolean;
  /** Makes the next refresh fail with this OAuth error. */
  refuseRefresh: string | null;
  /** Answers the token endpoint only when this promise resolves (to test coalescing). */
  gate: Promise<void> | null;
  /** Simulates the user agreeing at the authorization endpoint: the callback URL for an authorization URL. */
  authorize(authorizationUrl: string): string;
}

const b64url = (data: string | Buffer): string => Buffer.from(data).toString('base64url');

export function fakeServer(issuer = 'https://auth.example.com'): FakeServer {
  const codes = new Map<string, { challenge: string; nonce: string; clientId: string; redirectUri: string }>();
  const refreshTokens = new Set<string>();
  let counter = 0;

  const idToken = (clientId: string, nonce: string | undefined, s: FakeServer): string => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuer,
      aud: clientId,
      sub: 'user-1',
      iat: now,
      exp: now + 3600,
      ...(nonce ? { nonce } : {}),
      ...s.claims,
    };
    // the signature is not checked for an ID token from the token endpoint (TLS, OIDC Core 3.1.3.7 rule 6)
    return `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.${b64url('sig')}`;
  };

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  const server: FakeServer = {
    issuer,
    tokenRequests: [],
    discoveries: 0,
    expiresIn: 100,
    claims: {},
    issueRefresh: true,
    refuseRefresh: null,
    gate: null,
    authorize(authorizationUrl) {
      const url = new URL(authorizationUrl);
      const q = url.searchParams;
      const redirect = new URL(q.get('redirect_uri') ?? '');
      redirect.searchParams.set('state', q.get('state') ?? '');
      redirect.searchParams.set('iss', issuer); // RFC 9207: on errors too
      if (q.get('prompt') === 'none') {
        redirect.searchParams.set('error', 'login_required');
        return redirect.href;
      }
      const code = `code-${String(++counter)}`;
      codes.set(code, {
        challenge: q.get('code_challenge') ?? '',
        nonce: q.get('nonce') ?? '',
        clientId: q.get('client_id') ?? '',
        redirectUri: q.get('redirect_uri') ?? '',
      });
      redirect.searchParams.set('code', code);
      return redirect.href;
    },
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === '/.well-known/openid-configuration') {
        server.discoveries++;
        return json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          end_session_endpoint: `${issuer}/logout`,
          id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'],
          authorization_response_iss_parameter_supported: true,
        });
      }
      if (url.pathname !== '/token') return new Response(null, { status: 404 });
      const body = new URLSearchParams(
        typeof init?.body === 'string' ? init.body : init?.body instanceof URLSearchParams ? init.body : '',
      );
      server.tokenRequests.push(body);
      if (server.gate) await server.gate;
      const clientId = body.get('client_id') ?? '';
      const tokens = (nonce: string | undefined): Response => {
        const refresh = `refresh-${String(++counter)}`;
        if (server.issueRefresh) refreshTokens.add(refresh);
        return json({
          access_token: `access-${String(counter)}`,
          token_type: 'Bearer',
          expires_in: server.expiresIn,
          id_token: idToken(clientId, nonce, server),
          ...(server.issueRefresh ? { refresh_token: refresh } : {}),
        });
      };
      if (body.get('grant_type') === 'authorization_code') {
        const entry = codes.get(body.get('code') ?? '');
        codes.delete(body.get('code') ?? '');
        const challenge = createHash('sha256')
          .update(body.get('code_verifier') ?? '')
          .digest('base64url');
        if (entry?.challenge !== challenge || entry.redirectUri !== body.get('redirect_uri'))
          return json({ error: 'invalid_grant' }, 400);
        return tokens(entry.nonce);
      }
      if (body.get('grant_type') === 'refresh_token') {
        const token = body.get('refresh_token') ?? '';
        // rotation: a refresh token is single-use
        if (server.refuseRefresh || !refreshTokens.delete(token))
          return json({ error: server.refuseRefresh ?? 'invalid_grant' }, 400);
        return tokens(undefined);
      }
      return json({ error: 'unsupported_grant_type' }, 400);
    },
  };
  return server;
}

/** An in-memory `sessionStorage`. */
export function memoryStorage(): Storage & { readonly entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    get length() {
      return entries.size;
    },
    clear: () => {
      entries.clear();
    },
    getItem: (k) => entries.get(k) ?? null,
    key: (i) => [...entries.keys()][i] ?? null,
    removeItem: (k) => void entries.delete(k),
    setItem: (k, v) => void entries.set(k, v),
  };
}
