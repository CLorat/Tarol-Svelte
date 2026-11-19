#!/usr/bin/env bash
# Rebuilds every candidate bundle and prints raw, gzip (level 9) and brotli (quality 11) sizes. Usage:
#   pnpm install --frozen-lockfile --ignore-scripts && bash run.sh && node bench.cjs
set -euo pipefail
cd "$(dirname "$0")"; rm -rf dist
for c in Base BitsDialog MeltDialog OwnDialog List; do
  echo "import { mount } from 'svelte'; import C from './$c.svelte'; mount(C, { target: document.body });" > "e/m_$c.js"
done
for e in signalr ownhub oidcclient oauth4 openapifetch ownfetch m_Base m_BitsDialog m_MeltDialog m_OwnDialog m_List; do
  E="e/$e.js" O="$e" npx vite build >/dev/null
done
node size.mjs
npx @tailwindcss/cli -i tw/in.css -o tw/out.css --minify >/dev/null 2>&1
node -e "const fs=require('fs'),z=require('zlib');for(const f of ['tw/out.css','tw/own.css']){const b=fs.readFileSync(f);console.log(f.padEnd(18),'raw',String(b.length).padStart(7),'gzip',String(z.gzipSync(b,{level:9}).length).padStart(6),'br',String(z.brotliCompressSync(b).length).padStart(6))}"
