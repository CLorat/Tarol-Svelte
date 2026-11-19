#!/usr/bin/env node
// WCAG 2.2 contrast of every token pair in both themes (philosophy P6): text ≥ 4.5:1, UI boundaries ≥ 3:1.
import { dark, light, pairs } from '../packages/tarol-design/scripts/tokens.mjs';

/** Relative luminance of a #rrggbb colour (WCAG 2.2). */
export function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two #rrggbb colours. */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Returns the failing pairs of a theme as text lines. */
export function failures(theme, name, list = pairs) {
  const out = [];
  for (const [fg, bg, min] of list) {
    const ratio = contrast(theme[fg], theme[bg]);
    if (!(ratio >= min)) out.push(`${name}: ${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = [...failures(light, 'light'), ...failures(dark, 'dark')];
  for (const e of errors) console.error(e);
  const lowest = (t) => Math.min(...pairs.map(([f, b, m]) => contrast(t[f], t[b]) / m));
  console.log(
    `check-contrast: ${pairs.length * 2} pairs, ${errors.length} below the minimum; lowest margin light ×${lowest(light).toFixed(2)}, dark ×${lowest(dark).toFixed(2)}`,
  );
  process.exit(errors.length ? 1 : 0);
}
