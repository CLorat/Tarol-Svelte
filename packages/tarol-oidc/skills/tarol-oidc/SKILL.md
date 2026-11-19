---
name: tarol-oidc
description: >-
  Use when adding login, logout, token refresh or the signed-in user's tenant and roles to a browser app on a Tarol
  backend, especially one secured with Zitadel. Covers createOidc, handleRedirect, restore, login, logout, session,
  subscribe, provider (a TokenProvider for createClient and connectPush) and the zitadel preset with zitadelTenant and
  zitadelRoles from @clorat/tarol-oidc. Do not install oidc-client-ts, store tokens in localStorage, or derive the tenant
  by hand.
---

# Tarol login (`@clorat/tarol-oidc`)

## Rules

1. One `createOidc(...)` per app. Pass `oidc.provider` as `tokens` to `createClient` and `connectPush`; the client then
   sends the bearer token, keys its cache by `provider.tenant()`, and calls `provider.refresh()` once after a 401.
2. For a Zitadel-secured backend always use the preset: `createOidc(zitadel({ issuer, clientId, projectId, redirectUri }))`.
   It adds the scope `urn:zitadel:iam:org:project:id:<projectId>:aud`; without it **every backend call is 401**.
3. Call `await oidc.handleRedirect()` once at start-up, before the first backend call. Its result:
   `{ kind: 'none' }` (not a callback), `{ kind: 'signed-in', returnTo }`, `{ kind: 'signed-out', returnTo, error }`.
   Route to `returnTo` yourself if the router does not read `location` again.
4. Tokens live in memory. After a reload, `kind === 'none'` and `oidc.session() === null`: call `oidc.restore()` (a
   `prompt=none` redirect). It comes back as `signed-in`, or `signed-out` with `login_required`: then show a button that
   calls `oidc.login()`. Never call `restore()` after a `signed-out` result (that would loop).
5. Ask for `offline_access` (the Zitadel preset does) to get refresh tokens; refresh runs at 80 % of the lifetime and on a
   401 by itself. A refused refresh signs out and calls `onSignOut`.
6. `onSignOut: () => tarol.invalidate()` drops cached reads when the user signs out.
7. Roles and tenant come from `oidc.session()` (`roles`, `tenant`); for UI decisions only, the backend checks again.

## Example

```ts
import { createClient } from '@clorat/tarol-client';
import { createOidc } from '@clorat/tarol-oidc';
import { zitadel } from '@clorat/tarol-oidc/zitadel';

const oidc = createOidc(
  zitadel({
    issuer: import.meta.env.VITE_ISSUER,
    clientId: import.meta.env.VITE_CLIENT_ID,
    projectId: import.meta.env.VITE_PROJECT_ID,
    redirectUri: `${location.origin}/callback`,
    postLogoutRedirectUri: `${location.origin}/`,
    onSignOut: () => tarol.invalidate(),
  }),
);
export const tarol = createClient({ baseUrl: '/api', tokens: oidc.provider });

export async function start(): Promise<void> {
  const result = await oidc.handleRedirect();
  if (result.kind === 'none' && !oidc.session()) await oidc.restore();
}

oidc.subscribe((session) => console.log(session?.subject ?? 'signed out', session?.roles));
```

## Common mistakes

| Mistake | What happens |
|---|---|
| Zitadel without the preset (no `:aud` scope) | every backend call returns 401 with `WWW-Authenticate: Bearer` |
| `restore()` again after `signed-out` / `login_required` | an endless redirect loop; show the login button instead |
| A backend call before `handleRedirect()` resolved | it goes out anonymously: 401 |
| `issuer: 'http://localhost:8080'` without `allowHttp: true` | `login()` rejects (oauth4webapi refuses `http:`); use it for a local server only |
| `redirectUri` not registered on the app | the server shows an error page and never returns |
| Roles empty with Zitadel | the app lacks *User roles inside ID Token*, or the role is granted in another organisation (filtered, as the backend does) |
| Computing the tenant from the org id yourself | cache keys differ from the backend; use `provider.tenant()` or `await zitadelTenant(org)` |
| Reusing a callback URL (back button, reload) | `signed-out` with `state_mismatch`: the verifier is single-use |

## Notes

Browser only (WebCrypto, `sessionStorage`, `location`); tests inject `fetch`, `storage`, `navigate` and `replaceUrl`.
Size: 7.8 KB gzip with oauth4webapi, 8.2 KB with the Zitadel preset (budget 9 KB).
