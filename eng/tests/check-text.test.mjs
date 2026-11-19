import { test } from 'node:test';
import assert from 'node:assert/strict';
import { literals } from '../check-text.mjs';

test('literal text and labels are reported, expressions and symbols are not', () => {
  const found = literals(`<script>let { label } = $props();</script>
<button aria-label="Close">×</button>
<p>Hello {label}</p>
<span title={label}>{t('ui.more')}</span>`);
  assert.deepEqual(found, ['component.svelte:2: aria-label="Close"', 'component.svelte:3: Hello']);
});
