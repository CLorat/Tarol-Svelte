import { UserManager } from 'oidc-client-ts';
export const m = new UserManager({ authority: 'https://id', client_id: 'c', redirect_uri: '/cb', automaticSilentRenew: true });
m.signinRedirect(); m.signinRedirectCallback().then((u) => console.log(u?.access_token));
