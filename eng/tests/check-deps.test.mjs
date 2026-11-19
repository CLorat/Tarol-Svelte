import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../check-deps.mjs';

const good = {
  name: '@clorat/tarol-svelte',
  type: 'module',
  license: 'AGPL-3.0-only',
  sideEffects: false,
  exports: { '.': './dist/index.js' },
  dependencies: { '@clorat/tarol-client': 'workspace:*' },
  peerDependencies: { svelte: '^5.58.0' },
};

test('a package that follows the rules passes', () => assert.deepEqual(check(good), []));

test('an undecided runtime dependency fails', () =>
  assert.match(check({ ...good, dependencies: { lodash: '4.17.21' } }).join(), /lodash is not decided/));

test('an edge outside the package graph fails', () =>
  assert.match(
    check({ ...good, name: '@clorat/tarol-design', dependencies: { '@clorat/tarol-client': 'workspace:*' } }).join(),
    /tarol-design: may not depend on @clorat\/tarol-client/,
  ));

test('the allowlist is per package', () => {
  assert.deepEqual(
    check({ ...good, name: '@clorat/tarol-oidc', dependencies: { oauth4webapi: '3.8.8' }, peerDependencies: {} }),
    [],
  );
  assert.match(check({ ...good, dependencies: { oauth4webapi: '3.8.8' } }).join(), /oauth4webapi is not decided/);
});

test('CommonJS, a missing sideEffects field and another licence fail', () => {
  const noSideEffects = { ...good };
  delete noSideEffects.sideEffects;
  const errors = check({ ...noSideEffects, type: 'commonjs', license: 'MIT', main: 'index.js' }).join('\n');
  for (const m of ['ESM only', 'sideEffects', 'AGPL-3.0-only', 'no "main"']) assert.ok(errors.includes(m), m);
});

test('a package outside the plan fails', () =>
  assert.match(check({ ...good, name: '@clorat/other' }).join(), /not a package/));
