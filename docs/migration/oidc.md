# Step 6: `@clorat/tarol-oidc` (OIDC code + PKCE, Zitadel preset)

## 1. Inventory

From Tarol-Net (`src/Security/Tarol.Security.Zitadel`, [overview.md](../architecture/overview.md#auth-tarolsecurity-tarolsecurityzitadel)):
JWT bearer only; audience = project id; four scopes including `urn:zitadel:iam:org:project:id:<project>:aud` (without it
every call is 401); roles from `urn:zitadel:iam:org:project:<project>:roles`; tenant = a Guid derived from the org id;
401 without a body and `WWW-Authenticate: Bearer` [verified on the sample]. The sample's Zitadel setup creates **machine
users only** (client credentials), so a browser login needs BC-9.

## 2. Candidates, with measurements

Production bundles of a code + PKCE login with refresh [verified, `measurements/README.md`]:

| Library | Licence | gzip | brotli | Notes |
|---|---|---|---|---|
| `oidc-client-ts` 3.5.0 (`UserManager`) | Apache-2.0 | 21.87 KB | 18.83 KB | silent renew via iframe (third-party cookie blocking breaks it); its own storage |
| `oauth4webapi` 3.8.8 | MIT | 6.86 KB | 6.04 KB | zero dependencies, low-level and spec-exact; storage is ours |

Decided: `oauth4webapi`, tokens in memory only (SV-7). Budget ≤ 9 KB (SV-15).

## 3. Design

* `createOidc({ issuer, clientId, redirectUri, scopes })` → `{ login(returnTo?), handleRedirect(), logout(), session,
  provider: TokenProvider }`. PKCE verifier and state are kept in `sessionStorage` only between the redirect and its
  callback, then removed (they are single-use and useless afterwards).
* Access and refresh tokens live in memory. Refresh uses the refresh token (rotation) before expiry (at 80 % of the lifetime)
  and on a 401 (`provider.refresh()`); concurrent refreshes are coalesced.
* After a reload there are no tokens: `restore()` does a top-level redirect with `prompt=none`; the Zitadel session cookie
  answers it without user interaction, or the app shows its login.
* `tarol-oidc/zitadel`: `zitadel({ issuer, clientId, projectId })` adds the four scopes, reads the roles claim and computes
  the tenant (`SHA-256("zitadel-organisation:" + org)` with version and variant bits, as `ZitadelClaims.cs:87-94`) with
  WebCrypto, so the client's cache key matches the backend's tenant.
* Logout: end-session endpoint with `id_token_hint`, then the memory is cleared and the client's cache dropped.

## 4. What the PR must do

Unit tests against a fake authorization server (discovery, code exchange, refresh rotation, coalescing, expiry, logout); a
tenant-derivation test with the vector from Tarol-Net's tests; an integration test against Zitadel in Testcontainers (as
the backend's `tests/Security/Tarol.Security.Zitadel.IntegrationTests/Zitadel.cs`) once BC-9 provides a PKCE app; README;
skill `tarol-oidc`.

## 5. Built: public API, choices and verification

**Public API (new)**, reports `packages/tarol-oidc/api/tarol-oidc.api.md` and `tarol-oidc-zitadel.api.md`:
* `createOidc(options)` → `Oidc` (`provider`, `session()`, `subscribe()`, `login(returnTo?)`, `restore(returnTo?)`,
  `handleRedirect(url?)`, `logout()`); `OidcOptions`, `OidcSession`, `OidcClaimsMapping`, `OidcStorage`, `RedirectResult`
  (`none` / `signed-in` / `signed-out` with the OAuth error code).
* `/zitadel`: `zitadel(options)` → `OidcOptions`; `zitadelScopes(projectId)`, `zitadelTenant(organisation)`,
  `zitadelRoles(claims, projectId)`, `zitadelClaims(claims, projectId)`; `ZitadelOptions`.

**Choices made while building**

* `handleRedirect` returns a result instead of throwing for protocol outcomes (`login_required`, `access_denied`, a refused
  code, a forged or reused `state`, an invalid response); only a network failure throws. This makes the start-up code
  loop-free by construction: `restore()` is only called on `kind: 'none'`.
* The pending login (verifier, nonce, `returnTo`) is stored under `tarol-oidc:<state>` and removed **before** the code
  exchange, so a reused callback URL (back button, reload) is `state_mismatch` and never a second exchange.
* A `nonce` is sent and checked in addition to PKCE (OIDC Core 3.1.2.1; costs nothing).
* Refresh: a timer at 80 % of `expires_in`; `provider.token()` also refreshes an expired token itself (a throttled
  background tab may miss the timer). Concurrent refreshes share one promise, since a rotated refresh token is single-use.
  `ResponseBodyError` from the token endpoint (`invalid_grant`, …) ends the session and calls `onSignOut`; a network
  failure does not (the next call tries again). Without a refresh token the session ends at expiry.
* Tenant and roles come from the **ID token** claims (the access token is the backend's business and may be opaque). The
  roles filter by the user's organisation exactly as `ZitadelClaimsTransformation` does. Zitadel apps need *User roles
  inside ID Token* / *User Info inside ID Token* for this (README).
* `zitadelTenant` is checked against vectors produced by the backend's own `ZitadelTenants.Of` at `Tarol-Net@73b35ff`
  (a file-based `dotnet run` referencing `Tarol.Security.Zitadel`): `399724476671000579` →
  `2035b4f6-f1f6-89df-8a3a-f0acf1c07605`, `399724476671000580` → `94f8c8e6-45d4-8054-90d0-d13cb38b6b2e`, `1` →
  `4953efdc-6b13-8bce-b404-3258eba0ccf5` [verified]. Tarol-Net's tests contain no literal vector (they check stability and
  version 8 only). A cross-check through the sample's event store is not possible: the sample's streams all carry the empty
  tenant [verified by query].
* Zitadel v4.20.3 does not announce `authorization_response_iss_parameter_supported` [verified on the sample's discovery
  document], so RFC 9207's `iss` check is active only with servers that do; a test covers it.

**Suppressions:** one, `src/oidc.ts`: `@typescript-eslint/no-deprecated` on `oauth.allowInsecureRequests`. oauth4webapi
marks the option deprecated only so that its use stands out; it is the documented way to talk to an `http:` issuer, needed
for the sample's Zitadel on `http://localhost:8080`, and only active with `allowHttp: true`.

**Done in step 12 B3** ([backend-fixes.md](backend-fixes.md)): the contract tests sign ada and ben in on the sample's
PKCE app with Chromium on Zitadel's login page (once BC-18 gave the sample a login page), and the e2e signs in, reloads
(`prompt=none`) and refreshes against the real server. What step 6 recorded:

**Not done: browser login against Zitadel (waits for BC-9).** The sample's Zitadel setup creates machine users only; there
is no user-agent (PKCE) application and no human user with a password, so the full code + PKCE login, `prompt=none` and
the end-session redirect cannot run against the real server yet. The contract tests cover what can run: discovery and the
authorization request against Zitadel v4.20.3, and real Zitadel tokens mapped by the preset to the roles the backend
enforces. The Testcontainers integration test (as Tarol-Net's `Zitadel.cs`) and the e2e login (step 8) follow BC-9.

**Verification**

* Tests: **29** unit tests against a fake authorization server (`test/fake-server.ts`: discovery, code + PKCE checked by
  S256, refresh rotation with single-use refresh tokens, a gate for coalescing): login request, code exchange, default
  claims, forged state, replayed callback, foreign URLs, refused code, `prompt=none` → `login_required`, one discovery,
  refresh at 80 % with rotation, coalescing (3 calls → 1 request), refused refresh, expired token refreshed on demand,
  expiry without refresh token, 401 → refresh → repeat **through `createClient`**, logout URL, timer stopped by logout,
  `http:` refused unless allowed, 3 backend tenant vectors, version/variant bits, empty organisation, role filtering
  (3 cases), the preset scopes, a full preset sign-in, RFC 9207 mix-up defence. **3** contract tests against the running
  sample (`TAROL_E2E=1`) [verified, 32/32].
* Deliberate violation: dropping the version bits in `zitadelTenant` fails 5 tests [verified].
* Size: **7.77 KB gzip / 6.96 KB brotli** for `createOidc` with oauth4webapi; **8.19 KB gzip** with the Zitadel preset
  (budget 9 KB, SV-15) [verified, size-limit]. oauth4webapi alone was measured at 6.86 KB in the design.
* ESLint, tsc, publint, attw clean; API reports with 0 undocumented members.

## 6. Skill evaluation checklist

| Task | Expected API | Mistakes to avoid |
|---|---|---|
| "Add Zitadel login to the app" | `createOidc(zitadel({ issuer, clientId, projectId, redirectUri }))`, `oidc.provider` as `tokens` | `oidc-client-ts`; missing `:aud` scope (401) |
| "Keep the user signed in after a reload" | `handleRedirect()`, then `restore()` when `kind === 'none'` and no session | tokens in `localStorage`; calling `restore()` after `signed-out` (loop) |
| "Show the admin button only to admins" | `oidc.session()?.roles.includes('tarol-admin')`, `subscribe` | decoding the JWT by hand; trusting it for authorisation |
| "Sign out" | `oidc.logout()` with `onSignOut: () => tarol.invalidate()` | clearing only local state (the Zitadel session stays) |
| "Which tenant is this?" | `oidc.provider.tenant()` / `zitadelTenant(org)` | hashing the org id differently from the backend |
| "Local Zitadel on http" | `allowHttp: true` | disabling TLS checks globally |

An agent passes when it uses only these names and its code type-checks against the package.
