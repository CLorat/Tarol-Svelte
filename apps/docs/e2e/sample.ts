import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where the sample is: its API (TAROL_E2E_URL, default the AppHost's :5080), Zitadel and the setup's output folder. */
export const sample = {
  api: process.env['TAROL_E2E_URL'] ?? 'http://localhost:5080',
  issuer: process.env['TAROL_E2E_ISSUER'] ?? 'http://localhost:8080',
  zitadel: process.env['TAROL_E2E_ZITADEL'] ?? join(tmpdir(), 'artflow-zitadel'),
};

/** The sample's machine users (ZitadelSetup): alice is seller and tarol-admin, bob is bidder. */
export type User = 'alice' | 'bob';

/** A token for a machine user by client credentials, with the scopes `@clorat/tarol-oidc/zitadel` asks for. */
export async function accessToken(user: User): Promise<string> {
  const line = readFileSync(join(sample.zitadel, 'clients.txt'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`client ${user} `));
  const [, , id, secret] = line?.split(' ') ?? [];
  const project = readFileSync(join(sample.zitadel, 'project.txt'), 'utf8').trim();
  const scope = `openid urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner urn:zitadel:iam:org:project:id:${project}:aud`;
  const r = await fetch(`${sample.issuer}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${id ?? ''}:${secret ?? ''}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  });
  if (!r.ok) throw new Error(`token for ${user}: ${String(r.status)} ${await r.text()}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

/** Calls the sample's API directly (test setup, not the code under test). */
export async function api<T>(user: User, method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${sample.api}${path}`, {
    method,
    headers: { authorization: `Bearer ${await accessToken(user)}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!r.ok) throw new Error(`${method} ${path}: ${String(r.status)} ${await r.text()}`);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

/** A query on the sample's database through its PostgreSQL container, as the sample's apphost.sh does (test setup only). */
export function sql(query: string): string {
  const docker = (...args: string[]): string => execFileSync('docker', args, { encoding: 'utf8' }).trim();
  const container = docker('ps', '--filter', 'ancestor=postgres:18.3', '--format', '{{.Names}}').split('\n')[0] ?? '';
  const password =
    docker('inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}')
      .split('\n')
      .find((l) => l.startsWith('POSTGRES_PASSWORD='))
      ?.slice('POSTGRES_PASSWORD='.length) ?? '';
  return docker('exec', '-e', `PGPASSWORD=${password}`, container, 'psql', '-h', 'localhost', '-U', 'postgres', '-d', 'tarol', '-tAc', query);
}
