#!/usr/bin/env node
// Builds a package entry the way an app's bundler would (Vite + the Svelte compiler, production), so size-limit measures
// compiled runes, not the uncompiled `.svelte.js` source that a plain bundler would see. Svelte and the @clorat packages
// stay external: each package's budget covers its own code only (SV-15).
// usage: node eng/bundle-svelte.mjs <entry> <out> [<exports, comma separated>]
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';

const [entry, out, names] = process.argv.slice(2);
if (!entry || !out) throw new Error('usage: bundle-svelte.mjs <entry> <out> [exports]');
const probe = resolve(dirname(out), 'probe.js');
mkdirSync(dirname(out), { recursive: true });
// a consumer that uses the listed exports: tree-shaking keeps exactly what an app importing them gets
writeFileSync(
  probe,
  names
    ? `export { ${names} } from ${JSON.stringify(resolve(entry))};\n`
    : `export * from ${JSON.stringify(resolve(entry))};\n`,
);
await build({
  configFile: false,
  logLevel: 'error',
  plugins: [svelte({ configFile: false })],
  build: {
    lib: { entry: probe, formats: ['es'], fileName: () => 'bundle.js' },
    outDir: dirname(out),
    emptyOutDir: false,
    minify: true, // Vite 8: the Oxc minifier
    target: 'es2022',
    rollupOptions: { external: [/^svelte($|\/)/, /^@clorat\//] },
  },
});
