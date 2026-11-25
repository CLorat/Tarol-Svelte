import axe from 'axe-core';
import { expect } from 'vitest';

/** The violations of axe-core's WCAG 2.0–2.2 A/AA rules, plus the experimental rules named in `enable`. */
export async function violations(root: Element = document.body, enable: readonly string[] = []): Promise<string[]> {
  const result = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: Object.fromEntries(enable.map((id) => [id, { enabled: true }])),
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

/** Runs axe-core (WCAG 2.0–2.2 A/AA rules) on an element and expects no violation (philosophy P6). */
export async function expectAccessible(root: Element = document.body, enable: readonly string[] = []): Promise<void> {
  expect(await violations(root, enable)).toEqual([]);
}
