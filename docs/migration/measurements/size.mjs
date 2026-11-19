import { readFileSync, readdirSync } from 'node:fs'; import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
for (const f of readdirSync('dist').sort()) { const b = readFileSync('dist/' + f);
  console.log(f.padEnd(18), 'raw', String(b.length).padStart(7), 'gzip', String(gzipSync(b, { level: 9 }).length).padStart(6), 'br', String(brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length).padStart(6)); }
