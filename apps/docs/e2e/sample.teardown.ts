import { test as teardown } from '@playwright/test';
import { stopSample } from './apphost.js';

teardown('stop the sample it started', () => {
  stopSample();
});
