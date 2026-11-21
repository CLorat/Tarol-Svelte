import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';

const fixture = new URL('fixtures/artflow.openapi.json', import.meta.url).pathname;

describe('cli', () => {
  it('writes the module, and --check passes on it and fails after an edit', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'tarol-cli-')), 'api.ts');
    expect(await main([fixture, '-o', out])).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain('export function tarol(client: TarolClient)');
    expect(await main([fixture, '-o', out, '--check'])).toBe(0);
    writeFileSync(out, readFileSync(out, 'utf8') + '// hand edit\n');
    expect(await main([fixture, '-o', out, '--check'])).toBe(1);
  });

  it('exits 2 with the usage when arguments are missing', async () => {
    expect(await main([fixture])).toBe(2);
  });

  // An installed package runs as node_modules/.bin/tarol-codegen, a symlink to dist/cli.js (needs `pnpm build` first).
  it('runs through a bin link, as installed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tarol-bin-'));
    const bin = join(dir, 'tarol-codegen');
    symlinkSync(new URL('../dist/cli.js', import.meta.url).pathname, bin);
    const out = join(dir, 'api.ts');
    expect(execFileSync(process.execPath, [bin, fixture, '-o', out], { encoding: 'utf8' })).toContain('wrote');
    expect(readFileSync(out, 'utf8')).toContain('export function tarol(client: TarolClient)');
  });
});
