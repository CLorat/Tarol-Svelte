#!/usr/bin/env node
// svelte2tsx (svelte-package) emits a component as `/** doc */ declare const X: Component<…>; type X = ReturnType<typeof X>;`
// with the @component doc on the const only. API Extractor treats the merged `type X` as an undocumented declaration
// (ae-undocumented is an error here), so this copies the doc comment onto the type alias. usage: doc-svelte-dts.mjs <dist>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
let fixed = 0;
for (const f of readdirSync(dir).filter((n) => n.endsWith('.svelte.d.ts'))) {
  const p = join(dir, f);
  const s = readFileSync(p, 'utf8');
  const m = /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\s*declare const (\w+)\b[\s\S]*?;\n(type \2\b)/.exec(s);
  if (!m) continue;
  writeFileSync(p, s.replace(m[3], `${m[1]}\n${m[3]}`));
  fixed++;
}
console.log(`doc-svelte-dts: ${fixed} component declaration(s) documented`);
