import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { baseOf, changelogSection, notes, problems, setVersion, versionOf } from '../release.mjs';

/** A repository with two packages at 0.1.0 and a CHANGELOG with [Unreleased] and [0.1.0]. */
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'release-'));
  for (const name of ['tarol-client', 'tarol-oidc']) {
    const dir = join(root, 'packages', name);
    mkdirSync(join(dir, 'skills', name), { recursive: true });
    writeFileSync(join(dir, 'README.md'), '# readme\n');
    writeFileSync(join(dir, 'skills', name, 'SKILL.md'), '---\nname: x\n---\n');
    const json = {
      name: `@clorat/${name}`,
      version: '0.1.0',
      license: 'AGPL-3.0-only',
      publishConfig: { registry: 'https://npm.pkg.github.com' },
      files: ['dist', 'skills', 'README.md'],
    };
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify(json, null, 2)}\n`);
  }
  mkdirSync(join(root, 'apps', 'docs'), { recursive: true });
  writeFileSync(
    join(root, 'CHANGELOG.md'),
    '# Changelog\n\n## [Unreleased]\n\n* next\n\n## [0.1.0] - 2026-11-20\n\n* first\n',
  );
  return root;
}

test('a tag gives its version; anything else is refused', () => {
  assert.equal(versionOf('v0.1.0'), '0.1.0');
  assert.equal(versionOf('refs/tags/v1.2.3-preview.1'), '1.2.3-preview.1');
  assert.throws(() => versionOf('v1.2'), /not a release tag/);
  assert.throws(() => versionOf('release-1'), /not a release tag/);
  assert.deepEqual(baseOf('1.2.3-preview.1'), { base: '1.2.3', prerelease: true });
});

test('the CHANGELOG section ends at the next heading', () => {
  const root = repo();
  assert.equal(changelogSection(root, '0.1.0'), '* first');
  assert.equal(changelogSection(root, 'Unreleased'), '* next');
  assert.equal(changelogSection(root, '9.9.9'), null);
});

test('a complete release has no problem; a pre-release uses its base section', () => {
  const root = repo();
  assert.deepEqual(problems(root, '0.1.0'), []);
  setVersion(root, '0.1.0-preview.1');
  assert.deepEqual(problems(root, '0.1.0-preview.1'), []);
  assert.equal(
    JSON.parse(readFileSync(join(root, 'packages/tarol-oidc/package.json'), 'utf8')).version,
    '0.1.0-preview.1',
  );
});

test('each missing piece is reported (deliberate violations)', () => {
  const root = repo();
  const file = join(root, 'packages/tarol-oidc/package.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(
    file,
    JSON.stringify({
      ...json,
      version: '0.0.9',
      publishConfig: { registry: 'https://registry.npmjs.org' },
      files: ['dist'],
    }),
  );
  const found = problems(root, '0.2.0');
  assert.ok(found.some((p) => p.includes('@clorat/tarol-oidc: version 0.0.9')));
  assert.ok(found.some((p) => p.includes('publishConfig.registry')));
  assert.ok(found.some((p) => p.includes('does not ship skills/')));
  assert.ok(found.includes('CHANGELOG.md has no "## [0.2.0]" section'));
  // a dry run does not need the section
  assert.ok(!problems(root, '0.2.0', { dryRun: true }).some((p) => p.startsWith('CHANGELOG')));
});

test('private packages are not released', () => {
  const root = repo();
  const dir = join(root, 'packages', 'tarol-private');
  cpSync(join(root, 'packages', 'tarol-client'), dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: '@clorat/tarol-private', private: true, version: '9.9.9' }),
  );
  assert.deepEqual(problems(root, '0.1.0'), []);
});

test('the notes carry the section, the packages and the registry; a dry run falls back to Unreleased', () => {
  const root = repo();
  const text = notes(root, '0.1.0');
  assert.match(text, /^## tarol-svelte 0\.1\.0/);
  assert.match(text, /\* first/);
  assert.match(text, /`@clorat\/tarol-oidc@0\.1\.0`/);
  assert.match(text, /@clorat:registry=https:\/\/npm\.pkg\.github\.com/);
  assert.match(notes(root, '0.3.0', { dryRun: true }), /\* next/);
  assert.throws(() => notes(root, '0.3.0'), /no "## \[0\.3\.0\]" section/);
});
