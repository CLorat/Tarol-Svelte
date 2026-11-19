import { describe, expect, it } from 'vitest';
import { createOidc } from '../src/index.js';
import { zitadel, zitadelRoles, zitadelScopes, zitadelTenant } from '../src/zitadel.js';
import { fakeServer, memoryStorage } from './fake-server.js';

const organisation = '399724476671000579'; // the organisation of Tarol-Net's ZitadelClaimsTests
const project = '399724476671000123';

describe('zitadelTenant', () => {
  // produced by Tarol-Net's own ZitadelTenants.Of (src/Security/Tarol.Security.Zitadel/ZitadelClaims.cs:87-94) at 73b35ff
  it.each([
    ['399724476671000579', '2035b4f6-f1f6-89df-8a3a-f0acf1c07605'],
    ['399724476671000580', '94f8c8e6-45d4-8054-90d0-d13cb38b6b2e'],
    ['1', '4953efdc-6b13-8bce-b404-3258eba0ccf5'],
  ])('derives the backend tenant of %s', async (org, tenant) => {
    expect(await zitadelTenant(org)).toBe(tenant);
  });

  it('sets version 8 and the RFC 9562 variant', async () => {
    const tenant = await zitadelTenant('42');
    expect(tenant[14]).toBe('8');
    expect('89ab').toContain(tenant[19]);
  });

  it('refuses an empty organisation, as the backend does', async () => {
    await expect(zitadelTenant(' ')).rejects.toThrow(RangeError);
  });
});

describe('zitadelRoles', () => {
  const claim = `urn:zitadel:iam:org:project:${project}:roles`;

  it('keeps only the roles granted in the user organisation', () => {
    const claims = {
      'urn:zitadel:iam:user:resourceowner:id': organisation,
      [claim]: { clerk: { [organisation]: 'artflow.localhost' }, admin: { '7': 'other.localhost' } },
    };
    expect(zitadelRoles(claims, project)).toEqual(['clerk']);
  });

  it('keeps every role when the token names no organisation', () => {
    expect(zitadelRoles({ [claim]: { clerk: {}, admin: {} } }, project)).toEqual(['clerk', 'admin']);
  });

  it('reads only this project claim, never the generic one', () => {
    expect(zitadelRoles({ 'urn:zitadel:iam:org:project:roles': { admin: {} } }, project)).toEqual([]);
    expect(zitadelRoles({ [claim]: 'not an object' }, project)).toEqual([]);
  });
});

describe('zitadel preset', () => {
  it('asks for the four scopes Tarol needs, and a refresh token', () => {
    expect(zitadelScopes(project)).toEqual([
      'openid',
      'offline_access',
      'urn:zitadel:iam:org:projects:roles',
      'urn:zitadel:iam:user:resourceowner',
      `urn:zitadel:iam:org:project:id:${project}:aud`,
    ]);
  });

  it('signs in with the backend tenant and roles', async () => {
    const server = fakeServer();
    server.claims = {
      'urn:zitadel:iam:user:resourceowner:id': organisation,
      [`urn:zitadel:iam:org:project:${project}:roles`]: { clerk: { [organisation]: 'artflow.localhost' } },
    };
    const navigations: string[] = [];
    const oidc = createOidc(
      zitadel({
        issuer: server.issuer,
        clientId: 'spa',
        projectId: project,
        redirectUri: 'https://app.example.com/callback',
        fetch: server.fetch,
        storage: memoryStorage(),
        navigate: (u) => navigations.push(u),
        replaceUrl: () => undefined,
      }),
    );
    await oidc.login('/');
    const scope = new URL(navigations[0] ?? '').searchParams.get('scope');
    expect(scope?.split(' ')).toContain(`urn:zitadel:iam:org:project:id:${project}:aud`);
    expect((await oidc.handleRedirect(server.authorize(navigations[0] ?? ''))).kind).toBe('signed-in');
    expect(oidc.provider.tenant()).toBe('2035b4f6-f1f6-89df-8a3a-f0acf1c07605');
    expect(oidc.session()?.roles).toEqual(['clerk']);
  });
});

describe('mix-up defence', () => {
  it('refuses a callback without the iss parameter the server announced (RFC 9207)', async () => {
    const server = fakeServer();
    const navigations: string[] = [];
    const oidc = createOidc({
      issuer: server.issuer,
      clientId: 'spa',
      redirectUri: 'https://app.example.com/callback',
      fetch: server.fetch,
      storage: memoryStorage(),
      navigate: (u) => navigations.push(u),
      replaceUrl: () => undefined,
    });
    await oidc.login('/');
    const callback = new URL(server.authorize(navigations[0] ?? ''));
    callback.searchParams.delete('iss');
    expect(await oidc.handleRedirect(callback.href)).toMatchObject({ kind: 'signed-out', error: 'invalid_response' });
    expect(server.tokenRequests).toHaveLength(0);
  });
});
