import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkInstalled, packageNames } from '../consumer.mjs';

/** An app directory with installed packages: `{ name: [version, skill folder or null] }`. */
function installed(packages) {
  const dir = mkdtempSync(join(tmpdir(), 'consumer-'));
  for (const [name, [version, skill]] of Object.entries(packages)) {
    const pkg = join(dir, 'node_modules', name);
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name, version }));
    if (skill) {
      mkdirSync(join(pkg, 'skills', skill), { recursive: true });
      writeFileSync(join(pkg, 'skills', skill, 'SKILL.md'), '---\nname: x\n---\n');
    }
  }
  return dir;
}

test('the publishable packages of the repository are the 7 @clorat/tarol-* packages', () => {
  assert.deepEqual(packageNames(), [
    '@clorat/tarol-admin',
    '@clorat/tarol-client',
    '@clorat/tarol-codegen',
    '@clorat/tarol-components',
    '@clorat/tarol-design',
    '@clorat/tarol-oidc',
    '@clorat/tarol-svelte',
  ]);
});

test('an installed set with the version and a skill each has no problems', () => {
  const dir = installed({
    '@clorat/tarol-client': ['1.0.0', 'tarol-client'],
    '@clorat/tarol-oidc': ['1.0.0', 'tarol-oidc'],
  });
  assert.deepEqual(checkInstalled(dir, ['@clorat/tarol-client', '@clorat/tarol-oidc'], '1.0.0'), []);
});

test('a missing package, another version and a missing skill are each reported', () => {
  const dir = installed({ '@clorat/tarol-client': ['0.9.0', 'tarol-client'], '@clorat/tarol-oidc': ['1.0.0', null] });
  assert.deepEqual(
    checkInstalled(dir, ['@clorat/tarol-client', '@clorat/tarol-oidc', '@clorat/tarol-svelte'], '1.0.0'),
    [
      '@clorat/tarol-client: version 0.9.0, expected 1.0.0',
      '@clorat/tarol-oidc: no skills/tarol-*/SKILL.md',
      '@clorat/tarol-svelte: not installed',
    ],
  );
});
