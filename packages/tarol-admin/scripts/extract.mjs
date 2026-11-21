#!/usr/bin/env node
// Extracts the admin entry (Tarol-Net `MapTarolAdmin`, operation ids TarolAdmin…) from a Tarol backend's OpenAPI document,
// with the paths relative to the entry's prefix (an app mounts it where it likes; AdminApp's `prefix` prop puts it back),
// and the schemas they reference. usage: extract.mjs <openapi.json> <prefix> <out.json> [--check]
import { readFileSync, writeFileSync } from 'node:fs';

const [source, prefix, out, flag] = process.argv.slice(2);
if (!source || !prefix || !out) {
  console.error('usage: extract.mjs <openapi.json> <prefix> <out.json> [--check]');
  process.exit(2);
}
const document = JSON.parse(readFileSync(source, 'utf8'));
const schemas = document.components?.schemas ?? {};
const paths = {};
const used = new Set();
const visit = (node) => {
  if (Array.isArray(node)) node.forEach(visit);
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
        const name = v.slice('#/components/schemas/'.length);
        if (!used.has(name)) {
          used.add(name);
          visit(schemas[name]);
        }
      } else visit(v);
    }
};
for (const [path, item] of Object.entries(document.paths ?? {})) {
  if (path !== prefix && !path.startsWith(`${prefix}/`)) continue;
  paths[path.slice(prefix.length) || '/'] = item;
  visit(item);
}
if (Object.keys(paths).length === 0) {
  console.error(`extract: no path under ${prefix}`);
  process.exit(1);
}
const result = {
  openapi: document.openapi,
  info: {
    title: `The admin entry of ${document.info?.title ?? 'a Tarol backend'} (paths below ${prefix})`,
    version: document.info?.version ?? '1',
  },
  paths,
  components: { schemas: Object.fromEntries([...used].sort().map((n) => [n, schemas[n]])) },
};
const text = `${JSON.stringify(result, null, 2)}\n`;
if (flag === '--check') {
  let current = '';
  try {
    current = readFileSync(out, 'utf8');
  } catch {
    // missing: stale
  }
  if (current !== text) {
    console.error(`extract: ${out} is not up to date with ${source}; regenerate it`);
    process.exit(1);
  }
  console.log(`extract: ${out} up to date`);
} else {
  writeFileSync(out, text);
  console.log(`extract: ${Object.keys(paths).length} paths, ${used.size} schemas → ${out}`);
}
