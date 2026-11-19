#!/usr/bin/env node
// Writes dist/tokens.css from scripts/tokens.mjs. Everything is scoped under `.t-root` (set by ThemeRoot): no global
// selector, no reset (philosophy P3). `:where()` keeps the specificity at 0 so an app theme overrides with a plain rule.
import { mkdirSync, writeFileSync } from 'node:fs';
import { base, dark, light } from './tokens.mjs';

const vars = (o) =>
  Object.entries(o)
    .map(([k, v]) => `--t-${k}:${v}`)
    .join(';');
const css = [
  `:where(.t-root){${vars(base)};${vars(light)};color-scheme:light;color:var(--t-color-fg);background:var(--t-color-bg);font-family:var(--t-font-sans);font-size:var(--t-text-md);line-height:var(--t-leading)}`,
  `@media (prefers-color-scheme:dark){:where(.t-root:not([data-theme=light])){${vars(dark)};color-scheme:dark}}`,
  `:where(.t-root[data-theme=dark]){${vars(dark)};color-scheme:dark}`,
  `:where(.t-root[data-density=compact]){--t-density:0.75}`,
  `@media (prefers-reduced-motion:reduce){:where(.t-root){--t-duration-fast:0ms;--t-duration-normal:0ms}}`,
  `:where(.t-root) :where(*,*::before,*::after){box-sizing:border-box}`,
  `:where(.t-root) :where(:focus-visible){outline:2px solid var(--t-color-focus);outline-offset:2px}`,
].join('\n');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/tokens.css', css + '\n');
console.log(`tokens.css: ${css.length} bytes`);
