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
  // insert at the match, not at the first `type X…` of the file (`type CalendarView` comes before `type Calendar`)
  const at = m.index + m[0].length - m[3].length;
  writeFileSync(p, `${s.slice(0, at)}${m[1]}\n${s.slice(at)}`);
  fixed++;
}
console.log(`doc-svelte-dts: ${fixed} component declaration(s) documented`);
