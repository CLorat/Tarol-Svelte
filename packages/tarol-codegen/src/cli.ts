#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generate, GenerateError, type OpenApiDocument } from './generate.js';

const usage = `usage: tarol-codegen <openapi.json | http(s)://…/openapi/v1.json> -o <out.ts> [--check]

  -o, --out   the file to write (one TypeScript module)
  --check     do not write; exit 1 when the file differs from what the document generates (for CI)`;

/** Runs the command line; returns the exit code. */
export async function main(argv: readonly string[]): Promise<number> {
  const args = [...argv];
  const check = args.includes('--check');
  const o = Math.max(args.indexOf('-o'), args.indexOf('--out'));
  const out = o >= 0 ? args[o + 1] : undefined;
  const input = args.find((a, i) => !a.startsWith('-') && i !== o + 1);
  if (!input || !out) {
    process.stderr.write(`${usage}\n`);
    return 2;
  }
  const text = /^https?:\/\//.test(input) ? await (await fetch(input)).text() : await readFile(input, 'utf8');
  let code: string;
  try {
    code = generate(JSON.parse(text) as OpenApiDocument, {
      source: /^https?:\/\//.test(input) ? input : (input.split('/').at(-1) ?? input),
    });
  } catch (error) {
    if (error instanceof GenerateError) {
      process.stderr.write(`tarol-codegen: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
  if (check) {
    const current = await readFile(out, 'utf8').catch(() => '');
    if (current !== code) {
      process.stderr.write(`tarol-codegen: ${out} is not up to date with ${input}; regenerate it\n`);
      return 1;
    }
    return 0;
  }
  await writeFile(out, code);
  process.stdout.write(`tarol-codegen: wrote ${out}\n`);
  return 0;
}

/**
 * Whether this module is the program node runs, not a module a test imports. Installed, the program is the
 * `node_modules/.bin/tarol-codegen` link (a symlink, or a shim's target), so compare the resolved paths, not the names.
 */
function invoked(): boolean {
  const program = process.argv[1];
  if (!program) return false;
  try {
    return realpathSync(program) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invoked()) process.exitCode = await main(process.argv.slice(2));
