/** A run of a text: marked when it is what the search matched. */
export type Segment = { text: string; match: boolean };

/**
 * A text split where the search term matches it, ignoring case, so a row can
 * show why it is listed (ADR-0051 rule 3). The term is plain text and is
 * trimmed as the search trims it; nothing is lost or added, so the segments
 * join back to the text.
 */
export function markMatches(text: string, term: string): Segment[] {
  const needle = term.trim();
  if (!needle) return [{ text, match: false }];

  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const segments: Segment[] = [];
  let from = 0;
  for (const found of text.matchAll(pattern)) {
    if (found.index > from) segments.push({ text: text.slice(from, found.index), match: false });
    segments.push({ text: found[0], match: true });
    from = found.index + found[0].length;
  }
  if (from < text.length || segments.length === 0)
    segments.push({ text: text.slice(from), match: false });
  return segments;
}
