import axe from 'axe-core';
import { expect } from 'vitest';

/** Runs axe-core (WCAG 2.0–2.2 A/AA rules) on an element and expects no violation (philosophy P6). */
export async function expectAccessible(root: Element = document.body): Promise<void> {
  const result = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  });
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
