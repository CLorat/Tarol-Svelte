#!/usr/bin/env node
// Enforces the dependency rules of docs/architecture/philosophy.md (P1, P3) on every package in packages/:
// * runtime `dependencies` only from the allowlist (docs/migration/dependencies.md), peers only `svelte`;
// * internal dependencies only along the graph of docs/architecture/overview.md#packages;
// * ESM only, `sideEffects` declared, the AGPL licence, the owner's scope.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const graph = {
  '@clorat/tarol-client': [],
  '@clorat/tarol-oidc': ['@clorat/tarol-client'],
  '@clorat/tarol-svelte': ['@clorat/tarol-client'],
  '@clorat/tarol-codegen': [],
  '@clorat/tarol-design': [],
  '@clorat/tarol-components': ['@clorat/tarol-svelte', '@clorat/tarol-design', '@clorat/tarol-client'],
  '@clorat/tarol-admin': [
    '@clorat/tarol-components',
    '@clorat/tarol-svelte',
    '@clorat/tarol-design',
    '@clorat/tarol-client',
  ],
};

/** Third-party runtime dependencies decided in docs/migration/dependencies.md, per package. */
export const allowed = {
  '@clorat/tarol-oidc': ['oauth4webapi'],
};

export const allowedPeers = ['svelte'];

/** Returns the rule violations of one package.json object. */
export function check(pkg) {
  const errors = [];
  const name = pkg.name;
  if (!(name in graph)) errors.push(`${name}: not a package of the plan (eng/check-deps.mjs graph)`);
  if (pkg.type !== 'module') errors.push(`${name}: "type" must be "module" (ESM only)`);
  if (pkg.license !== 'AGPL-3.0-only') errors.push(`${name}: "license" must be "AGPL-3.0-only" (SV-1)`);
  if (!('sideEffects' in pkg)) errors.push(`${name}: "sideEffects" must be declared (tree-shaking, P1)`);
  if (!pkg.exports) errors.push(`${name}: "exports" is required`);
  if ('main' in pkg || 'module' in pkg) errors.push(`${name}: use "exports" only, no "main"/"module"`);
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (dep.startsWith('@clorat/')) {
      if (!(graph[name] ?? []).includes(dep)) errors.push(`${name}: may not depend on ${dep} (overview.md#packages)`);
    } else if (!(allowed[name] ?? []).includes(dep)) {
      errors.push(`${name}: runtime dependency ${dep} is not decided (docs/migration/dependencies.md)`);
    }
  }
  for (const dep of Object.keys(pkg.peerDependencies ?? {})) {
    if (dep.startsWith('@clorat/')) {
      if (!(graph[name] ?? []).includes(dep)) errors.push(`${name}: may not depend on ${dep} (overview.md#packages)`);
    } else if (!allowedPeers.includes(dep)) errors.push(`${name}: peer dependency ${dep} is not decided`);
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../packages/', import.meta.url).pathname;
  const dirs = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
  const errors = [];
  for (const d of dirs) {
    const file = join(root, d.name, 'package.json');
    if (existsSync(file)) errors.push(...check(JSON.parse(readFileSync(file, 'utf8'))));
  }
  for (const e of errors) console.error(e);
  console.log(`check-deps: ${dirs.length} package(s), ${errors.length} violation(s)`);
  process.exit(errors.length ? 1 : 0);
}
