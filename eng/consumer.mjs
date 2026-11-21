// The consumer check (SV-23): install the released packages the way an app does, then use them.
//
//   node eng/consumer.mjs <version>              from GitHub Packages (NODE_AUTH_TOKEN: a token with read:packages)
//   node eng/consumer.mjs <version> --from <dir> from the .tgz files in <dir> (a rehearsal before a tag)
//
// In an empty directory outside the repository: an .npmrc with the @clorat registry and no install scripts, the 7
// packages at <version> with Svelte, Vite and the Svelte plugin at the repository's versions; then every package must
// have that version and its skill, the installed `tarol-codegen` bin must generate the sample's client, and a page with
// createClient, setTarol, ThemeRoot, QueryState and DataTable must build and render its rows in Chromium.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** The publishable packages of this repository: `@clorat/tarol-*` names, from `packages/*`. */
export function packageNames(repo = root) {
  return readdirSync(join(repo, 'packages'))
    .map((d) => join(repo, 'packages', d, 'package.json'))
    .filter((p) => existsSync(p))
    .map((p) => JSON.parse(readFileSync(p, 'utf8')))
    .filter((p) => !p.private)
    .map((p) => p.name)
    .sort();
}

/** Problems of an installed `node_modules`: a missing package, another version, no `skills/tarol-<name>/SKILL.md`. */
export function checkInstalled(dir, names, version) {
  const found = [];
  for (const name of names) {
    const pkg = join(dir, 'node_modules', name);
    if (!existsSync(join(pkg, 'package.json'))) {
      found.push(`${name}: not installed`);
      continue;
    }
    const v = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version;
    if (v !== version) found.push(`${name}: version ${v}, expected ${version}`);
    const skills = existsSync(join(pkg, 'skills')) ? readdirSync(join(pkg, 'skills')) : [];
    if (!skills.some((s) => s.startsWith('tarol-') && existsSync(join(pkg, 'skills', s, 'SKILL.md'))))
      found.push(`${name}: no skills/tarol-*/SKILL.md`);
  }
  return found;
}

const app = `<script lang="ts">
  import { createClient } from '@clorat/tarol-client';
  import { ThemeRoot } from '@clorat/tarol-design';
  import { DataTable, QueryState, type Column } from '@clorat/tarol-components';
  import { list, setTarol } from '@clorat/tarol-svelte';

  interface Row { id: string; title: string; bids: number }
  setTarol(createClient({ baseUrl: '/api', tokens: { token: () => null, tenant: () => null } }));
  const rows = list<Row>(() => ({ path: '/auctions', query: { limit: 10 } }));
  const columns: Column[] = [{ key: 'title', header: 'Title' }, { key: 'bids', header: 'Bids', align: 'end' }];
</script>

<ThemeRoot>
  <QueryState state={rows} rows={10}>
    <DataTable list={rows} {columns} caption="Auctions" rowKey={(r: Row) => r.id}>
      {#snippet cell(row: Row, c: Column)}{c.key === 'title' ? row.title : row.bids}{/snippet}
    </DataTable>
  </QueryState>
</ThemeRoot>
`;

/** Serves `dist` and a fixed page of `/api/auctions`; renders the page; returns the problems. */
async function render(dist) {
  const { chromium } = await import('playwright');
  const items = [
    { id: 'a1', title: 'Bowl', bids: 3 },
    { id: 'a2', title: 'Vase', bids: 0 },
  ];
  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/api/auctions') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ items, next: null }));
      return;
    }
    const file = join(dist, url === '/' ? 'index.html' : url);
    if (!file.startsWith(dist) || !existsSync(file)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
    res.setHeader('content-type', type);
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const browser = await chromium.launch();
  const found = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => found.push(`page error: ${e.message}`));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.getByRole('gridcell', { name: 'Vase' }).waitFor({ timeout: 15_000 });
    const rowCount = await page.getByRole('row').count();
    if (rowCount !== items.length + 1) found.push(`the DataTable has ${rowCount} rows, expected ${items.length + 1}`);
  } catch (e) {
    found.push(`the page did not render its rows: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  } finally {
    await browser.close();
    server.close();
  }
  return found;
}

async function main(argv) {
  const version = argv[0];
  const fromAt = argv.indexOf('--from');
  const from = fromAt >= 0 ? resolve(argv[fromAt + 1] ?? '') : undefined;
  if (!version || version.startsWith('-')) {
    process.stderr.write('usage: consumer.mjs <version> [--from <dir with .tgz files>]\n');
    return 2;
  }
  const names = packageNames();
  const repo = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).devDependencies;
  const dir = mkdtempSync(join(tmpdir(), 'tarol-consumer-'));
  const spec = {};
  if (from) {
    const tgz = readdirSync(from).filter((f) => f.endsWith('.tgz'));
    for (const name of names) {
      const file = tgz.find((f) => f === `${name.replace('@', '').replace('/', '-')}-${version}.tgz`);
      if (!file) throw new Error(`no tarball of ${name}@${version} in ${from}`);
      spec[name] = `file:${join(from, file)}`;
    }
  } else for (const name of names) spec[name] = version;
  const pkg = {
    name: 'tarol-consumer',
    private: true,
    type: 'module',
    dependencies: {
      ...spec,
      svelte: repo['svelte'],
      vite: repo['vite'],
      '@sveltejs/vite-plugin-svelte': repo['@sveltejs/vite-plugin-svelte'],
    },
    // a tarball's own @clorat dependencies resolve to the other tarballs, not to the registry
    ...(from ? { overrides: spec } : {}),
  };
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(
    join(dir, '.npmrc'),
    [
      '@clorat:registry=https://npm.pkg.github.com',
      '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}',
      'ignore-scripts=true',
      '',
    ].join('\n'),
  );
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(`consumer: ${dir}\n`);
  run('npm', ['install', '--no-audit', '--no-fund']);

  const found = checkInstalled(dir, names, version);

  // the bin exactly as an app's script calls it
  const out = join(dir, 'api.ts');
  const fixture = join(root, 'packages/tarol-codegen/test/fixtures/artflow.openapi.json');
  try {
    run(join(dir, 'node_modules/.bin/tarol-codegen'), [fixture, '-o', out]);
    if (!existsSync(out) || !readFileSync(out, 'utf8').includes('export function tarol('))
      found.push('tarol-codegen: the installed bin wrote no client');
  } catch (e) {
    found.push(`tarol-codegen: the installed bin failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  }

  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/App.svelte'), app);
  writeFileSync(
    join(dir, 'src/main.ts'),
    "import '@clorat/tarol-design/tokens.css';\nimport { mount } from 'svelte';\nimport App from './App.svelte';\n\nmount(App, { target: document.getElementById('app')! });\n",
  );
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>consumer</title></head>\n<body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n',
  );
  writeFileSync(
    join(dir, 'vite.config.js'),
    "import { svelte } from '@sveltejs/vite-plugin-svelte';\nimport { defineConfig } from 'vite';\n\nexport default defineConfig({ plugins: [svelte()], build: { target: 'es2022' } });\n",
  );
  try {
    run(join(dir, 'node_modules/.bin/vite'), ['build', '--logLevel', 'warn']);
    found.push(...(await render(join(dir, 'dist'))));
  } catch (e) {
    found.push(`the page did not build: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  }

  for (const f of found) process.stdout.write(`problem: ${f}\n`);
  process.stdout.write(
    found.length === 0
      ? `consumer: ${names.length} packages at ${version} installed, skills present, bin and page work\n`
      : `consumer: ${found.length} problem(s)\n`,
  );
  return found.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main(process.argv.slice(2));
