import { test as setup } from '@playwright/test';
import { startSample } from './apphost.js';

setup('start the sample (unless TAROL_E2E_URL or a running one)', async () => {
  setup.setTimeout(300_000);
  await startSample();
});
