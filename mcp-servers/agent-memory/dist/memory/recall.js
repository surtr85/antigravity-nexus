export async function recallMemory(ctx, query, options = {}) {
    const searchOptions = {
        project: options.project,
        types: options.types,
        tags: options.tags,
        minConfidence: options.minConfidence,
        limit: options.limit ?? 5,
    };
    const results = await ctx.search.search(query, searchOptions);
    return results.map((r) => {
        const entry = {
            id: r.id,
            type: r.type,
            title: r.title,
            project: r.project,
            confidence: r.confidence,
            status: r.status,
            updated: r.updatedAt,
            score: r.score,
            snippet: r.snippet,
            tags: r.tags,
            related: [],
        };
        if (options.includeRelated) {
            entry.related = relatedTitles(ctx, r.id);
        }
        return entry;
    });
}
function relatedTitles(ctx, id) {
    const rows = ctx.db.raw
        .prepare(`SELECT m.title AS title
       FROM memory_links l JOIN memories m ON m.id = l.target_id
       WHERE l.source_id = ?`)
        .all(id);
    return rows.map((r) => r.title);
}
//# sourceMappingURL=recall.js.map