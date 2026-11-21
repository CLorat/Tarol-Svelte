// Counts the example files of docs/review/frontend-ease.md: code lines (not blank, not a comment), import statements
// and the names imported from @clorat packages and the generated client. Run: node docs/migration/measurements/review-count.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../../../apps/docs/src/review/', import.meta.url).pathname;
const rows = [];
for (const file of readdirSync(dir).sort()) {
  if (!/\.(svelte|ts)$/.test(file)) continue;
  const text = readFileSync(join(dir, file), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const lines = text.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('//'));
  const imports = [...text.matchAll(/import\s+(type\s+)?(\{[^}]*\}|\S+)\s+from\s+'([^']+)'/g)];
  const names = new Set();
  for (const m of imports) {
    if (!m[3].startsWith('@clorat/') && !m[3].includes('api.js')) continue;
    for (const n of m[2].replace(/[{}]/g, '').split(',')) if (n.trim()) names.add(n.replace(/^\s*type\s+/, '').trim());
  }
  rows.push({ file, lines: lines.length, imports: imports.length + (text.match(/^import '/gm)?.length ?? 0), names: [...names].join(' ') });
}
for (const r of rows) console.log(`${r.file}\t${String(r.lines)}\t${String(r.imports)}\t${r.names}`);
