#!/usr/bin/env node
// Philosophy P7: no hard-coded user-visible text in shipped components. Parses every packages/*/src/**/*.svelte with the
// Svelte compiler and reports text nodes and static aria-label/title/placeholder/alt values that contain a letter.
// Text must come from props (the app's own words) or from the message catalogue (`t('…')`).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'svelte/compiler';

const attributes = new Set(['aria-label', 'title', 'placeholder', 'alt', 'aria-description']);
const letter = /\p{L}/u;

/** Returns `file:line: text` for every literal text in one component's source. */
export function literals(source, file = 'component.svelte') {
  const ast = parse(source, { modern: true });
  const out = [];
  const line = (pos) => source.slice(0, pos).split('\n').length;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === 'Text' && letter.test(node.data)) out.push(`${file}:${line(node.start)}: ${node.data.trim()}`);
    for (const a of node.attributes ?? [])
      if (a.type === 'Attribute' && attributes.has(a.name) && Array.isArray(a.value))
        for (const v of a.value)
          if (v.type === 'Text' && letter.test(v.data)) out.push(`${file}:${line(v.start)}: ${a.name}="${v.data}"`);
    // other attribute values (class, type, role, SVG paths) are not user-visible text
    for (const [k, v] of Object.entries(node))
      if (k !== 'parent' && k !== 'attributes' && typeof v === 'object') walk(v);
  };
  walk(ast.fragment);
  return out;
}

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.svelte') ? [p] : [];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../packages/', import.meta.url).pathname;
  const all = readdirSync(root).flatMap((p) => {
    try {
      return files(join(root, p, 'src'));
    } catch {
      return [];
    }
  });
  const found = all.flatMap((f) => literals(readFileSync(f, 'utf8'), f.slice(root.length)));
  for (const f of found) console.error(f);
  console.log(`check-text: ${all.length} component(s), ${found.length} literal text(s)`);
  process.exit(found.length ? 1 : 0);
}
