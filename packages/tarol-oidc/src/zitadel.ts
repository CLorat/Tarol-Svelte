import type { OidcClaimsMapping, OidcOptions } from './oidc.js';

export type { OidcClaimsMapping, OidcOptions, OidcStorage } from './oidc.js';

/** Settings of {@link zitadel}: the {@link OidcOptions} without the parts the preset fills in. */
export interface ZitadelOptions extends Omit<OidcOptions, 'scopes' | 'claims'> {
  /** The project id: the backend's audience (`ZitadelOptions.ProjectId` in Tarol-Net). */
  readonly projectId: string;
  /** Extra scopes beyond the preset's. */
  readonly scopes?: readonly string[] | undefined;
}

const resourceOwner = 'urn:zitadel:iam:user:resourceowner:id';

/**
 * The scopes Tarol's Zitadel backend needs: the user's organisation (the tenant), the project's roles, and the project
 * as audience. Without the `:aud` scope the access token is not for the backend and every call is answered with 401.
 * `offline_access` asks for a refresh token.
 */
export function zitadelScopes(projectId: string): readonly string[] {
  return [
    'openid',
    'offline_access',
    'urn:zitadel:iam:org:projects:roles',
    'urn:zitadel:iam:user:resourceowner',
    `urn:zitadel:iam:org:project:id:${projectId}:aud`,
  ];
}

/**
 * The tenant of a Zitadel organisation, exactly as the backend derives it (`ZitadelTenants.Of` in
 * `Tarol.Security.Zitadel`): SHA-256 of `"zitadel-organisation:" + organisation`, the first 16 bytes as a Guid with
 * version 8 and the RFC 9562 variant, in the lowercase `8-4-4-4-12` form.
 */
export async function zitadelTenant(organisation: string): Promise<string> {
  if (organisation.trim() === '') throw new RangeError('tarol-oidc: the organisation id is empty');
  const data = new TextEncoder().encode(`zitadel-organisation:${organisation}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x80;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(hash.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The roles of a project as the backend reads them: the keys of the claim `urn:zitadel:iam:org:project:<id>:roles`
 * (`{"role":{"<organisation>":"<domain>"}}`), only those granted in the user's organisation when the token names it.
 */
export function zitadelRoles(claims: Readonly<Record<string, unknown>>, projectId: string): readonly string[] {
  const roles = claims[`urn:zitadel:iam:org:project:${projectId}:roles`];
  if (typeof roles !== 'object' || roles === null || Array.isArray(roles)) return [];
  const organisation = claims[resourceOwner];
  const org = typeof organisation === 'string' && organisation !== '' ? organisation : null;
  return Object.entries(roles as Record<string, unknown>)
    .filter(([, grants]) => org === null || (typeof grants === 'object' && grants !== null && org in grants))
    .map(([role]) => role);
}

/** Maps the claims of a Zitadel ID token to the backend's tenant and roles. */
export async function zitadelClaims(
  claims: Readonly<Record<string, unknown>>,
  projectId: string,
): Promise<OidcClaimsMapping> {
  const organisation = claims[resourceOwner];
  return {
    tenant: typeof organisation === 'string' && organisation !== '' ? await zitadelTenant(organisation) : null,
    roles: zitadelRoles(claims, projectId),
  };
}

/**
 * The settings of `createOidc` for a Tarol backend secured by `Tarol.Security.Zitadel`.
 *
 * @example
 * ```ts
 * const oidc = createOidc(zitadel({ issuer, clientId, projectId, redirectUri }));
 * ```
 */
export function zitadel(options: ZitadelOptions): OidcOptions {
  const { projectId, scopes, ...rest } = options;
  return {
    ...rest,
    scopes: [...zitadelScopes(projectId), ...(scopes ?? [])],
    claims: (claims) => zitadelClaims(claims, projectId),
  };
}
