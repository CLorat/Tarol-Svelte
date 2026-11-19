import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, failures } from '../check-contrast.mjs';

test('black on white is 21:1, white on white 1:1', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrast('#ffffff', '#ffffff'), 1);
});

test('a pair below its minimum is reported', () => {
  const theme = { fg: '#999999', bg: '#ffffff' }; // 2.85:1
  assert.match(failures(theme, 'light', [['fg', 'bg', 4.5]]).join(), /light: fg on bg = 2\.85 < 4\.5/);
  assert.deepEqual(failures(theme, 'light', [['fg', 'bg', 2.5]]), []);
});
