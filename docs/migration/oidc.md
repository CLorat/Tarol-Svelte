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
