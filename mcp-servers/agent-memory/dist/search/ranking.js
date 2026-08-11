import { linkCount } from "../graph/links.js";
import { CONFIDENCE_BASE, STATUS_PENALTY } from "./search.js";
/**
 * Produces a final score from FTS rank, title overlap, and metadata boosts.
 * bm25() returns strongly negative values; -bm25 is the base relevance.
 * Boosts are added on top, so recency/status/graph/title never dominate semantic relevance.
 */
export function rankScore(row, projectBoost, db, tokens = [], rawQuery = "") {
    let score = -row.bm25rank;
    score += STATUS_PENALTY[row.status] ?? 0;
    const confBoost = CONFIDENCE_BASE[row.confidence] ?? 0;
    score += confBoost;
    if (projectBoost)
        score += 1.5;
    const typeBoost = { skill: 0.4, pattern: 0.3, lesson: 0.2 };
    score += typeBoost[row.type] ?? 0;
    // Title matching boost: exact title or title token match increases relevance
    const titleLower = row.title.toLowerCase();
    const queryLower = rawQuery.toLowerCase().trim();
    if (queryLower !== "" && titleLower === queryLower) {
        score += 3.0;
    }
    else if (queryLower !== "" && (titleLower.includes(queryLower) || queryLower.includes(titleLower))) {
        score += 2.0;
    }
    else if (tokens.length > 0) {
        let titleTokenHits = 0;
        for (const tok of tokens) {
            if (titleLower.includes(tok))
                titleTokenHits++;
        }
        score += Math.min(titleTokenHits * 0.6, 2.0);
    }
    // Modest recency boost: 0.5 within 3 days, fading to 0 after 14.
    const ageDays = (Date.now() - Date.parse(row.updated_at)) / 86_400_000;
    if (!Number.isNaN(ageDays) && ageDays < 14) {
        score += Math.max(0, 0.5 * (1 - ageDays / 14));
    }
    // Graph evidence: a well-linked memory is more likely to matter.
    score += 0.2 * Math.log1p(linkCount(db, row.id));
    return Math.round(score * 100) / 100;
}
export function makeSnippet(content, tokens, maxLength = 260) {
    const clean = content.replace(/\s+/g, " ").trim();
    if (clean.length <= maxLength)
        return clean;
    let start = 0;
    for (const token of tokens) {
        const idx = clean.toLowerCase().indexOf(token);
        if (idx > maxLength / 2) {
            start = idx - maxLength / 4;
            break;
        }
    }
    start = Math.max(0, start);
    let snippet = clean.slice(start, start + maxLength);
    if (start > 0)
        snippet = "…" + snippet;
    if (start + maxLength < clean.length)
        snippet = snippet + "…";
    return snippet;
}
//# sourceMappingURL=ranking.js.map