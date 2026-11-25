#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generate, GenerateError, type OpenApiDocument } from './generate.js';

const usage = `usage: tarol-codegen <openapi.json | http(s)://…/openapi/v1.json> -o <out.ts> [--check] [--strict]

  -o, --out   the file to write (one TypeScript module)
  --check     do not write; exit 1 when the file differs from what the document generates (for CI)
  --strict    an operation without x-tarol-kind is an error (default: skipped with a warning)`;

/** Runs the command line; returns the exit code. */
export async function main(argv: readonly string[]): Promise<number> {
  const args = [...argv];
  const check = args.includes('--check');
  const strict = args.includes('--strict');
  const o = Math.max(args.indexOf('-o'), args.indexOf('--out'));
  const out = o >= 0 ? args[o + 1] : undefined;
  const input = args.find((a, i) => !a.startsWith('-') && i !== o + 1);
  if (!input || !out) {
    process.stderr.write(`${usage}\n`);
    return 2;
  }
  const remote = /^https?:\/\//.test(input);
  let document: OpenApiDocument;
  try {
    document = await read(input, remote);
  } catch (error) {
    return fail(error instanceof Failure ? error.message : `cannot read ${input}: ${String(error)}`);
  }
  let code: string;
  try {
    code = generate(document, {
      source: remote ? input : (input.split('/').at(-1) ?? input),
      strict,
      onWarning: (message) => process.stderr.write(`tarol-codegen: warning: ${message}\n`),
    });
  } catch (error) {
    // a GenerateError names the pointer; anything else is a bug here, still one line and exit 1
    return fail(error instanceof GenerateError ? error.message : `internal error: ${String(error)}`);
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

/** A failure to read the document, with the message for stderr. */
class Failure extends Error {}

/**
 * Reads and parses the document. Every failure (no file, an HTTP status other than 2xx, a network error, a body that is
 * not JSON) is a {@link Failure} with one line naming the input, so a script that sends stdout to /dev/null still sees it.
 */
async function read(input: string, remote: boolean): Promise<OpenApiDocument> {
  let text: string;
  if (remote) {
    const response = await fetch(input).catch((error: unknown) => {
      throw new Failure(`cannot fetch ${input}: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (!response.ok)
      throw new Failure(`${input} answered ${String(response.status)} ${response.statusText}`.trimEnd());
    text = await response.text();
  } else {
    text = await readFile(input, 'utf8').catch((error: unknown) => {
      const code = (error as { code?: unknown }).code;
      throw new Failure(`cannot read ${input}: ${typeof code === 'string' ? code : String(error)}`);
    });
  }
  try {
    return JSON.parse(text) as OpenApiDocument;
  } catch (error) {
    throw new Failure(`${input} is not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Writes one line to stderr and returns the exit code 1. */
function fail(message: string): number {
  process.stderr.write(`tarol-codegen: ${message.replace(/\s*\n\s*/g, ' ')}\n`);
  return 1;
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
