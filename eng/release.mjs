#!/usr/bin/env node
// Release steps of docs/migration/release.md (the model of Tarol-Net's eng/release.py):
//   node eng/release.mjs version <tag>                 print the version a tag v<x.y.z>[-pre] stands for
//   node eng/release.mjs set-version <version>         write it into every publishable package.json
//   node eng/release.mjs check <version> [--dry-run]   fail unless every package ships what a release needs
//   node eng/release.mjs notes <version> [--dry-run]   print the release notes (the CHANGELOG section, how to install)
// --dry-run (a run without a tag): problems are printed as warnings and the notes fall back to "## [Unreleased]".
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const registry = 'https://npm.pkg.github.com';
const versionPattern = /^(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?$/;

/** The version of a tag `v1.2.3` or `v1.2.3-preview.1`; throws for anything else. */
export function versionOf(tag) {
  const version = tag.replace(/^refs\/tags\//, '').replace(/^v/, '');
  if (!versionPattern.test(version)) throw new Error(`not a release tag: ${tag}`);
  return version;
}

/** `1.2.3` of `1.2.3-preview.1`: pre-releases use the CHANGELOG section of their base version. */
export function baseOf(version) {
  const m = versionPattern.exec(version);
  if (!m) throw new Error(`not a version: ${version}`);
  return { base: m[1], prerelease: m[2] !== undefined };
}

/** The publishable packages: every packages/<dir>/package.json that is not private. */
export function packages(root) {
  const dir = join(root, 'packages');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'package.json')))
    .map((d) => ({ dir: join(dir, d.name), json: JSON.parse(readFileSync(join(dir, d.name, 'package.json'), 'utf8')) }))
    .filter((p) => p.json.private !== true)
    .sort((a, b) => a.json.name.localeCompare(b.json.name));
}

/** The body of `## [heading]` in CHANGELOG.md up to the next `## `, or null. */
export function changelogSection(root, heading) {
  const text = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(text);
  return m ? m[1].trim() : null;
}

/** Writes `version` into every publishable package.json (internal `workspace:*` ranges are resolved by pnpm pack). */
export function setVersion(root, version) {
  baseOf(version);
  for (const p of packages(root)) {
    p.json.version = version;
    writeFileSync(join(p.dir, 'package.json'), `${JSON.stringify(p.json, null, 2)}\n`);
  }
}

/** Every reason the packages cannot be released as `version` (empty when they can). */
export function problems(root, version, { dryRun = false } = {}) {
  const found = [];
  const { base } = baseOf(version);
  const list = packages(root);
  if (list.length === 0) found.push('no publishable package in packages/');
  for (const { dir, json } of list) {
    const name = json.name;
    if (!name.startsWith('@clorat/tarol-')) found.push(`${name}: not in the @clorat/tarol-* scope (SV-14)`);
    if (json.version !== version) found.push(`${name}: version ${json.version}, the release is ${version}`);
    if (json.license !== 'AGPL-3.0-only') found.push(`${name}: licence ${json.license} (SV-1)`);
    if (json.publishConfig?.registry !== registry)
      found.push(`${name}: publishConfig.registry must be ${registry} (SV-14)`);
    if (!existsSync(join(dir, 'README.md'))) found.push(`${name}: no README.md`);
    const skills = join(dir, 'skills');
    const hasSkill = existsSync(skills) && readdirSync(skills).some((s) => existsSync(join(skills, s, 'SKILL.md')));
    if (!hasSkill) found.push(`${name}: no skills/<name>/SKILL.md`);
    if (!(json.files ?? []).includes('skills')) found.push(`${name}: "files" does not ship skills/`);
  }
  if (!dryRun && changelogSection(root, base) === null) found.push(`CHANGELOG.md has no "## [${base}]" section`);
  return found;
}

/** The release notes: the CHANGELOG section of the version (Unreleased in a dry run) and how to install. */
export function notes(root, version, { dryRun = false } = {}) {
  const { base } = baseOf(version);
  const section = changelogSection(root, base) ?? (dryRun ? changelogSection(root, 'Unreleased') : null);
  if (section === null) throw new Error(`CHANGELOG.md has no "## [${base}]" section`);
  const names = packages(root).map((p) => `- \`${p.json.name}@${version}\``);
  return [
    `## tarol-svelte ${version}`,
    '',
    section,
    '',
    '### Packages',
    '',
    ...names,
    '',
    '### Install',
    '',
    'The packages are on GitHub Packages, which needs a token with `read:packages` for installs:',
    '',
    '```ini',
    '# .npmrc',
    `@clorat:registry=${registry}`,
    `//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}`,
    '```',
    '',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, arg, ...rest] = process.argv.slice(2);
  const dryRun = rest.includes('--dry-run');
  const root = new URL('..', import.meta.url).pathname;
  try {
    if (command === 'version') console.log(versionOf(arg ?? ''));
    else if (command === 'set-version') setVersion(root, arg ?? '');
    else if (command === 'check') {
      const found = problems(root, arg ?? '', { dryRun });
      for (const p of found) console.log(`${dryRun ? '::warning::' : '::error::'}${p}`);
      console.log(
        `release check ${arg ?? ''}: ${String(packages(root).length)} package(s), ${String(found.length)} problem(s)`,
      );
      if (found.length > 0 && !dryRun) process.exit(1);
    } else if (command === 'notes') process.stdout.write(notes(root, arg ?? '', { dryRun }));
    else {
      console.error(
        'usage: release.mjs version <tag> | set-version <v> | check <v> [--dry-run] | notes <v> [--dry-run]',
      );
      process.exit(2);
    }
  } catch (e) {
    console.error(`::error::${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
