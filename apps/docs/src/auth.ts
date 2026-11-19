import type { TokenProvider } from '@clorat/tarol-client';
import { createOidc } from '@clorat/tarol-oidc';
import { zitadel } from '@clorat/tarol-oidc/zitadel';

/**
 * What the e2e suite puts on the page before it loads (Playwright `addInitScript`): a machine user's token from Zitadel's
 * client-credentials grant, and a way to get a new one. Test only: it stands in for the browser login until the sample
 * has a PKCE app and human users (BC-9). A build never sets it.
 */
interface E2eTokens {
  token: string;
  tenant: string;
  refresh: () => Promise<string | null>;
}

declare global {
  interface Window {
    __tarolE2E?: E2eTokens;
  }
}

/** The app's TokenProvider: the e2e one when present, else the Zitadel login when configured, else anonymous. */
export async function tokens(): Promise<TokenProvider | undefined> {
  const e2e = window.__tarolE2E;
  if (e2e) {
    let token = e2e.token;
    return {
      token: () => token,
      tenant: () => e2e.tenant,
      async refresh() {
        const next = await e2e.refresh();
        if (next === null) return false;
        token = next;
        return true;
      },
    };
  }
  const env = import.meta.env;
  const clientId = env['VITE_ZITADEL_CLIENT_ID'] as string | undefined;
  const projectId = env['VITE_ZITADEL_PROJECT_ID'] as string | undefined;
  if (!clientId || !projectId) return undefined;
  const issuer = (env['VITE_ZITADEL_ISSUER'] as string | undefined) ?? 'http://localhost:8080';
  const oidc = createOidc(
    zitadel({
      issuer,
      clientId,
      projectId,
      redirectUri: `${location.origin}/`,
      postLogoutRedirectUri: `${location.origin}/`,
      allowHttp: issuer.startsWith('http://localhost'),
    }),
  );
  const result = await oidc.handleRedirect();
  if (result.kind === 'none' && !oidc.session()) await oidc.restore();
  return oidc.provider;
}
