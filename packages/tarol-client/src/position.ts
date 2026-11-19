/**
 * Compares two `Tarol-Position` values (`<tx>.<pos>`, both decimal integers). Returns a negative number when `a` is
 * earlier, 0 when equal, a positive number when later. A malformed value counts as earliest.
 */
export function comparePositions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? -1 : 1;
  if (pa[0] !== pb[0]) return pa[0] < pb[0] ? -1 : 1;
  return pa[1] === pb[1] ? 0 : pa[1] < pb[1] ? -1 : 1;
}

function parse(p: string): [bigint, bigint] | null {
  const m = /^(\d+)\.(\d+)$/.exec(p);
  return m?.[1] !== undefined && m[2] !== undefined ? [BigInt(m[1]), BigInt(m[2])] : null;
}
