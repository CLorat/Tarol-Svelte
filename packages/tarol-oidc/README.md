# @clorat/tarol-oidc

Login for single-page apps on [Tarol](https://github.com/CLorat/Tarol-Net) backends: OpenID Connect authorization code
with PKCE on [`oauth4webapi`](https://github.com/panva/oauth4webapi), tokens **in memory only**, refresh ahead of expiry
and after a 401, logout through the end-session endpoint. It implements the `TokenProvider` port of
`@clorat/tarol-client`. The `/zitadel` preset matches `Tarol.Security.Zitadel`: scopes, roles and the tenant id.

```ts
import { createClient } from '@clorat/tarol-client';
import { createOidc } from '@clorat/tarol-oidc';
import { zitadel } from '@clorat/tarol-oidc/zitadel';

const oidc = createOidc(
  zitadel({
    issuer: 'https://auth.example.com',
    clientId: '…', // a Zitadel user-agent app (PKCE, no secret)
    projectId: '…', // the backend's audience
    redirectUri: `${location.origin}/callback`,
    postLogoutRedirectUri: `${location.origin}/`,
    onSignOut: () => tarol.invalidate(),
  }),
);
const tarol = createClient({ baseUrl: '/api', tokens: oidc.provider });

// at start-up, once
const result = await oidc.handleRedirect();
if (result.kind === 'none' && !oidc.session()) await oidc.restore(); // after a reload: prompt=none
// result.kind === 'signed-out' → show the login button: oidc.login()
```

| What | Behaviour |
|---|---|
| Login | `login(returnTo?)`: a top-level redirect with `code_challenge` (S256), `state` and `nonce`. They wait in `sessionStorage` until the callback, which removes them before anything else (single use). |
| Callback | `handleRedirect()` → `{ kind: 'none' }` (not a callback), `'signed-in'` or `'signed-out'` with the OAuth error (`login_required`, `access_denied`, `invalid_grant`, `state_mismatch`, `invalid_response`). It replaces the URL with `returnTo`. |
| Tokens | in memory; a reload forgets them. `restore()` asks the server with `prompt=none`; its session cookie answers without user interaction, or the result is `login_required`, never a loop. |
| Refresh | with `offline_access`: at 80 % of the access token's lifetime, on a 401 (`provider.refresh()`, used by the client) and when an expired token is asked for. Concurrent refreshes share one request; a refused refresh ends the session. |
| Logout | `logout()`: the memory is cleared, `onSignOut` runs, then the end-session endpoint with `id_token_hint` and `post_logout_redirect_uri`. |
| Session | `session()` and `subscribe(listener)`: `subject`, `tenant`, `roles`, `claims`, `expiresAt`. |

## Zitadel

`zitadel({ issuer, clientId, projectId, redirectUri })` asks for `openid`, `offline_access`,
`urn:zitadel:iam:org:projects:roles`, `urn:zitadel:iam:user:resourceowner` and
`urn:zitadel:iam:org:project:id:<projectId>:aud` (without the last one every backend call is 401). From the ID token it
reads the roles of `urn:zitadel:iam:org:project:<projectId>:roles` granted in the user's organisation, and derives the
tenant exactly as the backend does (`ZitadelTenants.Of`: SHA-256 of `"zitadel-organisation:" + org`, a version 8 Guid),
so `provider.tenant()` equals the backend's tenant. Enable *User roles inside ID Token* and *User Info inside ID Token* on
the Zitadel app for roles and organisation to be in the ID token; the backend reads the access token itself.

## Security notes

* Tokens never reach `localStorage`, `sessionStorage` or cookies; only the single-use PKCE verifier, state and nonce do,
  for the length of a redirect.
* `http:` issuers are refused unless `allowHttp: true` (a local authorization server only).
* RFC 9207: when the server announces `authorization_response_iss_parameter_supported`, a callback without the right
  `iss` is refused (mix-up defence).

Runs in browsers with WebCrypto. ESM only, no side effects. Licence: AGPL-3.0-only, or the owner's commercial licence.
