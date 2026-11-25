// Tatalu FB-F05.1-4 and FB-INT3-6 (TS-36): with typescript-eslint's typed rules, an app's own .svelte imports are opaque
// (TypeScript's project service reads no .svelte file, so it sees svelte's ambient `*.svelte` module): types exported
// from <script module> are unresolved and the parameter of an app component's callback is `any`. The packages' components
// are typed through their generated .svelte.d.ts. This test pins both, and that the skill's recipe lints clean; when the
// tooling learns .svelte imports, the first test fails and the recipe can be relaxed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dir = 'eng/tests/fixtures/typed-lint';
// the fixtures are ignored by the repository's lint run (they contain the errors on purpose)
const eslint = new ESLint({ cwd: root, ignore: false });
const problems = async (file) =>
  (await eslint.lintFiles([`${dir}/${file}`]))[0].messages.map((m) => `${String(m.line)}: ${m.ruleId ?? m.message}`);

test('an app component: <script module> types are unresolved and a callback parameter is any', async () => {
  const found = await problems('Bad.svelte');
  assert.ok(found.includes('6: @typescript-eslint/no-unsafe-member-access'), found.join('\n')); // s.id, s: Sent
  assert.ok(found.includes('9: @typescript-eslint/no-unsafe-member-access'), found.join('\n')); // c.id, c: any
});

test('the recipe lints clean: types from a .ts module, annotated parameters, package components as they are', async () => {
  assert.deepEqual(await problems('Good.svelte'), []);
  assert.deepEqual(await problems('Typed.svelte'), []);
});
