#!/usr/bin/env node
// Generates src/catalogue/props.json: for every component of tarol-design, tarol-components and tarol-admin, its `@component` doc and
// its props (name, type, optional, default, doc), read with the TypeScript compiler from the component's own `Props`
// interface (or `<Name>Props`). The docs app's props tables come from here, never from hand-written lists.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const root = new URL('../../../packages/', import.meta.url).pathname;
const out = new URL('../src/catalogue/props.json', import.meta.url).pathname;
const packages = ['tarol-design', 'tarol-components', 'tarol-admin'];

function component(file) {
  const source = readFileSync(file, 'utf8');
  const doc = /<!--\s*@component\s*([\s\S]*?)-->/.exec(source)?.[1].replace(/\s+/g, ' ').trim() ?? '';
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const sf = ts.createSourceFile(file, scripts, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const name = file.split('/').at(-1).replace('.svelte', '');
  let props;
  const defaults = {};
  sf.forEachChild(function visit(node) {
    if (ts.isInterfaceDeclaration(node) && (node.name.text === 'Props' || node.name.text === `${name}Props`)) props = node;
    // `let { a = 1, b = $bindable(2) }: Props = $props()` holds the defaults
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer?.getText(sf).startsWith('$props')) {
      for (const e of node.name.elements)
        if (e.initializer && ts.isIdentifier(e.name)) defaults[e.name.text] = e.initializer.getText(sf).replace(/^\$bindable\((.*)\)$/s, '$1');
    }
    node.forEachChild(visit);
  });
  const extendsText = props?.heritageClauses?.map((h) => h.types.map((t) => t.getText(sf)).join(', ')).join(', ') ?? '';
  const members = (props?.members ?? []).filter(ts.isPropertySignature).map((m) => ({
    name: m.name.getText(sf),
    type: (m.type?.getText(sf) ?? 'unknown').replace(/\s*\|\s*undefined$/, '').replace(/\s+/g, ' '),
    optional: m.questionToken !== undefined,
    bindable: /\$bindable/.test(scripts.match(new RegExp(`\\b${m.name.getText(sf)}\\s*=\\s*\\$bindable`))?.[0] ?? ''),
    default: defaults[m.name.getText(sf)] ?? null,
    doc: ts.getJSDocCommentsAndTags(m).map((d) => (typeof d.comment === 'string' ? d.comment : '')).join(' ').replace(/\s+/g, ' ').trim(),
  }));
  return { name, doc, extends: extendsText, props: members };
}

const result = {};
for (const pkg of packages) {
  const dir = join(root, pkg, 'src/lib');
  // the package's public components only (its index exports them); internal parts get no page
  const index = readFileSync(join(dir, 'index.ts'), 'utf8');
  const exported = (f) => index.includes(`from './${f}'`);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.svelte') && exported(f)).sort()) {
    const c = component(join(dir, f));
    result[c.name] = { package: `@clorat/${pkg}`, ...c };
  }
}
const text = `${JSON.stringify(result, null, 2)}\n`;
if (process.argv.includes('--check')) {
  // CI: the committed file must be what the components' types say
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) {
    console.error('props: src/catalogue/props.json is stale; run pnpm --filter @clorat/tarol-docs props');
    process.exit(1);
  }
  console.log(`props: ${String(Object.keys(result).length)} components, up to date`);
} else {
  writeFileSync(out, text);
  console.log(`props: ${String(Object.keys(result).length)} components → src/catalogue/props.json`);
}
