// Task 1, first screen: main.ts of an app with login and push (the minimal correct start-up today).
import '@clorat/tarol-design/tokens.css';
import { createClient } from '@clorat/tarol-client';
import { connectPush } from '@clorat/tarol-client/push';
import { createOidc } from '@clorat/tarol-oidc';
import { zitadel } from '@clorat/tarol-oidc/zitadel';
import { mount } from 'svelte';
import App from './FirstApp.svelte';

export async function start(target: HTMLElement): Promise<void> {
  const oidc = createOidc(
    zitadel({
      issuer: 'https://login.example.com',
      clientId: 'web',
      projectId: 'artflow',
      redirectUri: `${location.origin}/`,
      onSignOut: () => {
        client.invalidate();
      },
    }),
  );
  const client = createClient({ baseUrl: '/api', tokens: oidc.provider });
  const result = await oidc.handleRedirect();
  if (result.kind === 'none' && !oidc.session()) await oidc.restore();
  const push = connectPush({ url: '/api/tarol/messages', tokens: oidc.provider });
  mount(App, { target, props: { client, push } });
}
