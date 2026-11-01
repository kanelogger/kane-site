export const noteTerms = (query) => [...new Set(query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))];

// Return original text offsets, including normalization expansions such as ﬁ → fi.
export function noteMatchRanges(text, query) {
  const terms = noteTerms(query);
  if (!terms.length) return [];
  const offsets = [];
  let normalized = '';
  for (const { segment, index } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    const value = segment.normalize('NFKC').toLocaleLowerCase();
    for (let i = 0; i < value.length; i++) offsets.push([index, index + segment.length]);
    normalized += value;
  }
  const ranges = [];
  for (const term of terms) {
    let start = normalized.indexOf(term);
    while (start !== -1) {
      ranges.push([offsets[start][0], offsets[start + term.length - 1][1]]);
      start = normalized.indexOf(term, start + 1);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

// Dates use the Beijing calendar date written in notes.md, not the viewer's timezone.
export function matchesNote(text, date, { q = '', from = '', to = '' } = {}) {
  const terms = noteTerms(q);
  const normalized = text.normalize('NFKC').toLocaleLowerCase();
  return terms.every((term) => normalized.includes(term))
    && (!from || date >= from) && (!to || date <= to);
}
