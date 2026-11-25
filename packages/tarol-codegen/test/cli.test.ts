import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
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

  // Tatalu FB-F06.6-1: `pnpm generate >/dev/null` in a script must not hide a failure. Every failure exits non-zero with
  // one line `tarol-codegen: …` on stderr (no stack trace) and nothing on stdout, whatever the cause.
  it('fails loudly: exit code 1, one tarol-codegen line on stderr, nothing on stdout (TS-37)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tarol-fail-'));
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ openapi: '3.1.0', paths: { '/x': { get: { 'x-tarol-kind': 'view' } } } }));
    const notJson = join(dir, 'not-json.json');
    writeFileSync(notJson, '<html>502 Bad Gateway</html>');
    const server = createServer((_, res) => {
      res.writeHead(503, { 'content-type': 'application/problem+json' });
      res.end(JSON.stringify({ title: 'Service Unavailable', status: 503 }));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/openapi/v1.json`;
    const bin = new URL('../dist/cli.js', import.meta.url).pathname;
    const run = (input: string) =>
      new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
        const child = execFile(process.execPath, [bin, input, '-o', join(dir, 'api.ts')], (_, stdout, stderr) => {
          resolve({ code: child.exitCode, stdout, stderr });
        });
      });
    try {
      const cases: [string, string][] = [
        [bad, 'operationId is required'],
        [notJson, `${notJson} is not JSON`],
        [join(dir, 'missing.json'), `cannot read ${join(dir, 'missing.json')}`],
        [url, `${url} answered 503`],
      ];
      for (const [input, message] of cases) {
        const r = await run(input);
        expect({ input, code: r.code, stdout: r.stdout }).toEqual({ input, code: 1, stdout: '' });
        expect(r.stderr).toMatch(/^tarol-codegen: [^\n]+\n$/);
        expect(r.stderr).toContain(message);
      }
    } finally {
      server.close();
    }
  });
});
