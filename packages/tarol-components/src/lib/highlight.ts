/** A piece of a highlighted text: `mark` pieces are the matched words. */
export interface Segment {
  /** The text, to be rendered as text (never as HTML). */
  readonly text: string;
  /** `true` for a highlighted range. */
  readonly mark: boolean;
}

/** A highlighted range as the backend's search answers it: UTF-16 code units, a JavaScript string's indexes. */
export interface Highlight {
  /** The first code unit. */
  readonly start: number;
  /** The number of code units. */
  readonly length: number;
}

/**
 * Splits a plain-text snippet at its highlight ranges, for rendering as text with `<mark>` around the matches. Ranges
 * out of the text are cut to it, overlapping ones merged, empty ones dropped, so any server answer gives valid pieces.
 */
export function highlight(text: string, highlights: readonly Highlight[] = []): Segment[] {
  const ranges = highlights
    .map((h) => [Math.max(0, h.start), Math.min(text.length, h.start + h.length)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: Segment[] = [];
  let at = 0;
  for (const [a, b] of ranges) {
    if (b <= at) continue;
    const from = Math.max(a, at);
    const last = out.at(-1);
    if (from > at) out.push({ text: text.slice(at, from), mark: false });
    else if (last?.mark) out.pop(); // overlapping or adjacent: one mark
    out.push({ text: (from > at || !last?.mark ? '' : last.text) + text.slice(from, b), mark: true });
    at = b;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: false });
  return out;
}
