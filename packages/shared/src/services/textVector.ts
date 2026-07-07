const stopWords = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "for",
  "with",
  "what",
  "why",
  "did",
  "do",
  "we",
  "should",
  "this",
  "that",
  "last",
  "next",
  "from",
  "into",
  "on",
  "is",
  "are",
  "was",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function cosineLikeScore(queryTokens: string[], documentTokens: string[]): number {
  if (queryTokens.length === 0 || documentTokens.length === 0) return 0;
  const docCounts = new Map<string, number>();
  for (const token of documentTokens) {
    docCounts.set(token, (docCounts.get(token) ?? 0) + 1);
  }
  let overlap = 0;
  for (const token of queryTokens) {
    overlap += docCounts.get(token) ?? 0;
  }
  const norm = Math.sqrt(queryTokens.length) * Math.sqrt(documentTokens.length);
  return Number((overlap / norm).toFixed(4));
}
