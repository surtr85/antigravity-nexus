export function tokenizeQuery(query: string): string[] {
  const tokens = new Set<string>();
  for (const token of query.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (token.length < 2) continue;
    if (STOPWORDS.has(token)) continue;
    tokens.add(token);
  }
  return [...tokens];
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "is",
  "are", "was", "were", "how", "why", "what", "did", "do", "does", "we", "you",
  "it", "this", "that", "from", "by", "at", "as", "our", "have", "has", "had",
  "been", "being", "be", "not", "but", "so", "if", "then", "when", "where",
]);

export function ftsMatchQuery(query: string): string | null {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return null;
  // OR the prefix terms and let bm25 rank: docs matching more terms rank first.
  return tokens.map((token) => ftsTerm(token)).join(" OR ");
}

function ftsTerm(token: string): string {
  return `"${token.replace(/"/g, '""')}"*`;
}

export function queryTokens(query: string): string[] {
  return tokenizeQuery(query);
}
