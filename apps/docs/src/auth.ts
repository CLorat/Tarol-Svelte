import { createOidc, type Oidc } from '@clorat/tarol-oidc';
import { zitadel } from '@clorat/tarol-oidc/zitadel';

/** Where the app signs in: a Zitadel user-agent app (PKCE) and the backend's project (its audience). */
interface LoginConfig {
  issuer: string;
  clientId: string;
  projectId: string;
}

/**
 * The deployment's login settings: `VITE_ZITADEL_CLIENT_ID` / `VITE_ZITADEL_PROJECT_ID` (/ `VITE_ZITADEL_ISSUER`) at build
 * time, else `oidc.json` next to the app at run time (so one build serves any sample run: the client id is made per
 * run). Without either the app is anonymous (the component catalogue needs no backend).
 */
async function config(): Promise<LoginConfig | undefined> {
  const env = import.meta.env;
  const clientId = env['VITE_ZITADEL_CLIENT_ID'] as string | undefined;
  const projectId = env['VITE_ZITADEL_PROJECT_ID'] as string | undefined;
  const issuer = (env['VITE_ZITADEL_ISSUER'] as string | undefined) ?? 'http://localhost:8080';
  if (clientId && projectId) return { issuer, clientId, projectId };
  try {
    const r = await fetch(new URL('oidc.json', location.href));
    if (!r.ok) return undefined;
    const c = (await r.json()) as Partial<LoginConfig>;
    return c.clientId && c.projectId ? { issuer: c.issuer ?? issuer, clientId: c.clientId, projectId: c.projectId } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The browser login (code + PKCE, tokens in memory): finishes a callback, or asks Zitadel silently (`prompt=none`) after a
 * reload; signed out, the app offers `login()`. `undefined` when the deployment has no login settings.
 */
export async function signIn(): Promise<Oidc | undefined> {
  const c = await config();
  if (!c) return undefined;
  const oidc = createOidc(
    zitadel({
      issuer: c.issuer,
      clientId: c.clientId,
      projectId: c.projectId,
      redirectUri: `${location.origin}/`,
      postLogoutRedirectUri: `${location.origin}/`,
      allowHttp: c.issuer.startsWith('http://localhost'),
    }),
  );
  const result = await oidc.handleRedirect();
  // after a reload the tokens are gone: one silent attempt per load (its answer is a callback, so never a loop)
  if (result.kind === 'none' && !oidc.session()) await oidc.restore();
  return oidc;
}
