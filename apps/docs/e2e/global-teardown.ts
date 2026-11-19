import { existsSync, readFileSync, rmSync } from 'node:fs';
import { pidFile } from './global-setup.js';

/** Stops the AppHost the setup started (its process group: the API, worker, billing and the containers' orchestrator). */
export default function globalTeardown(): void {
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, 'utf8'));
  rmSync(pidFile);
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // already gone
  }
}
