import { spawn } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sample } from './sample.js';

export const pidFile = join(import.meta.dirname, '.apphost.pid');

const ready = async (): Promise<boolean> => {
  try {
    return (await fetch(`${sample.api}/health/ready`)).ok;
  } catch {
    return false;
  }
};

/**
 * Starts the sample's Aspire AppHost (Tarol-Net samples/Sagas, built with `dotnet build samples/Sagas/AppHost`) unless
 * TAROL_E2E_URL names a running backend or one is already up, then waits for /health/ready (at most 240 s) and for
 * the Zitadel setup's client list.
 */
export default async function globalSetup(): Promise<void> {
  let started = 0;
  if (!process.env['TAROL_E2E_URL'] && !(await ready())) {
    const net = resolve(process.env['TAROL_NET'] ?? join(import.meta.dirname, '../../../../Tarol-Net'));
    const dll = join(net, 'samples/Sagas/AppHost/bin/Debug/net11.0/ArtFlow.AppHost.dll');
    if (!existsSync(dll)) throw new Error(`e2e: build the sample first: dotnet build ${net}/samples/Sagas/AppHost`);
    const child = spawn('dotnet', [dll], {
      cwd: join(net, 'samples/Sagas/AppHost'),
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        ASPIRE_ALLOW_UNSECURED_TRANSPORT: 'true',
        DOTNET_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS: 'true',
        ASPNETCORE_URLS: 'http://localhost:18888',
        ASPIRE_DASHBOARD_OTLP_HTTP_ENDPOINT_URL: 'http://localhost:18890',
      },
    });
    child.unref();
    started = Date.now();
    writeFileSync(pidFile, String(child.pid));
  }
  const until = Date.now() + 240_000;
  // a started AppHost's Zitadel setup rewrites the client list: one from an earlier run has stale secrets
  const clients = join(sample.zitadel, 'clients.txt');
  const fresh = (): boolean => existsSync(clients) && statSync(clients).mtimeMs >= started;
  while (!(await ready()) || !fresh()) {
    if (Date.now() > until) throw new Error(`e2e: ${sample.api}/health/ready did not answer 200 within 240 s`);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}
