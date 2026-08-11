const WIKILINK_RE = /\[\[([^\[\]]+?)\]\]/g;
export function extractWikilinks(content) {
    const links = [];
    const seen = new Set();
    for (const match of content.matchAll(WIKILINK_RE)) {
        const inner = match[1];
        if (!inner)
            continue;
        const targetPart = inner.split("|", 2)[0];
        if (targetPart === undefined)
            continue;
        const label = targetPart.trim().replace(/^\.\//, "");
        if (label === "")
            continue;
        const key = label.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        const alias = inner.split("|", 2)[1];
        links.push({ label, alias: alias ? alias.trim() : undefined });
    }
    return links;
}
export function normalizeTitle(title) {
    return title.toLowerCase().replace(/\s+/g, " ").trim();
}
export function linkTargetKey(label) {
    // "Notes/Some Note" -> "some note"
    const parts = label.split("/");
    const base = parts[parts.length - 1] ?? label;
    return normalizeTitle(base.replace(/\.md$/i, ""));
}
export function buildTitleIndex(db) {
    const byNormalized = new Map();
    const byId = new Map();
    const rows = db.raw
        .prepare("SELECT id, title FROM memories")
        .all();
    for (const row of rows) {
        byId.set(row.id, row.title);
        const key = normalizeTitle(row.title);
        if (!byNormalized.has(key))
            byNormalized.set(key, row.id);
    }
    return { byNormalized, byId };
}
export function resolveWikilinkTargets(links, index) {
    const resolved = [];
    const seen = new Set();
    for (const link of links) {
        const key = linkTargetKey(link.label);
        const id = index.byNormalized.get(key);
        if (id !== undefined && !seen.has(id)) {
            seen.add(id);
            resolved.push(id);
        }
    }
    return resolved;
}
export function replaceLinks(db, sourceId, targetIds, relation) {
    db.raw.prepare("DELETE FROM memory_links WHERE source_id = ? AND relation = ?").run(sourceId, relation);
    addLinks(db, sourceId, targetIds, relation);
}
export function addLinks(db, sourceId, targetIds, relation) {
    const stmt = db.raw.prepare("INSERT OR IGNORE INTO memory_links (source_id, target_id, relation) VALUES (?, ?, ?)");
    for (const targetId of targetIds) {
        if (targetId === sourceId)
            continue;
        stmt.run(sourceId, targetId, relation);
    }
}
export function outboundIds(db, sourceId, relations) {
    const where = relations && relations.length > 0
        ? ` AND relation IN (${relations.map(() => "?").join(",")})`
        : "";
    const params = [sourceId, ...(relations ?? [])];
    return db.raw
        .prepare(`SELECT target_id AS id, relation FROM memory_links WHERE source_id = ?${where}`)
        .all(...params);
}
export function inboundIds(db, targetId) {
    return db.raw
        .prepare("SELECT source_id AS id, relation FROM memory_links WHERE target_id = ?")
        .all(targetId);
}
export function linkCount(db, id) {
    const row = db.raw
        .prepare("SELECT (SELECT count(*) FROM memory_links WHERE source_id = ?) + (SELECT count(*) FROM memory_links WHERE target_id = ?) AS c")
        .get(id, id);
    return row.c;
}
//# sourceMappingURL=links.js.map