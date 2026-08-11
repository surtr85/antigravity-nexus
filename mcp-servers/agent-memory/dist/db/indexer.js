import { buildTitleIndex, replaceLinks, resolveWikilinkTargets } from "../graph/links.js";
import { scanVault } from "../vault/scanner.js";
export function rowToMemory(row, related = []) {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        content: row.content,
        project: row.project ?? undefined,
        confidence: row.confidence,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        source: row.source ?? undefined,
        sourceSession: row.source_session ?? undefined,
        tags: JSON.parse(row.tags_json),
        related,
    };
}
function normalizeTitleForIndex(title) {
    return title.toLowerCase().replace(/\s+/g, " ").trim();
}
export function upsertMemoryIndex(db, memory, content, wikilinks, filePath) {
    const tagsJson = JSON.stringify(memory.tags);
    db.withTransaction(() => {
        db.raw
            .prepare(`INSERT INTO memories
           (id, path, type, title, content, project, confidence, status,
            created_at, updated_at, source, source_session, tags_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           path = excluded.path,
           type = excluded.type,
           title = excluded.title,
           content = excluded.content,
           project = excluded.project,
           confidence = excluded.confidence,
           status = excluded.status,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at,
           source = excluded.source,
           source_session = excluded.source_session,
           tags_json = excluded.tags_json`)
            .run(memory.id, filePath, memory.type, memory.title, content, memory.project ?? null, memory.confidence, memory.status, memory.createdAt, memory.updatedAt, memory.source ?? null, memory.sourceSession ?? null, tagsJson);
        db.raw.prepare("DELETE FROM memory_fts WHERE id = ?").run(memory.id);
        db.raw
            .prepare("INSERT INTO memory_fts (id, type, project, title, content, tags) VALUES (?, ?, ?, ?, ?, ?)")
            .run(memory.id, memory.type, memory.project ?? "", memory.title, content, memory.tags.join(" "));
        const index = buildTitleIndex(db);
        index.byNormalized.set(normalizeTitleForIndex(memory.title), memory.id);
        index.byId.set(memory.id, memory.title);
        const targets = resolveWikilinkTargets(wikilinks, index);
        replaceLinks(db, memory.id, targets, "related");
    });
}
export function removeMemoryIndex(db, id) {
    db.withTransaction(() => {
        db.raw.prepare("DELETE FROM memory_links WHERE source_id = ? OR target_id = ?").run(id, id);
        db.raw.prepare("DELETE FROM memory_fts WHERE id = ?").run(id);
        db.raw.prepare("DELETE FROM memories WHERE id = ?").run(id);
    });
}
export function fullReindex(db, vaultPath) {
    const scan = scanVault(vaultPath);
    db.withTransaction(() => {
        db.raw.prepare("DELETE FROM memory_fts").run();
        db.raw.prepare("DELETE FROM memory_links").run();
        db.raw.prepare("DELETE FROM memories").run();
    });
    for (const note of scan.notes) {
        upsertMemoryIndex(db, note.memory, note.body, note.wikilinks, note.filePath);
    }
    db.raw
        .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_indexed', ?)")
        .run(new Date().toISOString());
    return { root: scan.root, indexed: scan.notes.length, invalid: scan.invalid, duplicateIds: scan.duplicateIds };
}
export function countMemories(db) {
    const row = db.raw.prepare("SELECT count(*) AS c FROM memories").get();
    return row.c;
}
export function memoryById(db, id) {
    const row = db.raw.prepare("SELECT * FROM memories WHERE id = ?").get(id);
    if (!row)
        return null;
    return rowToMemory(row, relatedIds(db, id));
}
export function memoryPathById(db, id) {
    const row = db.raw.prepare("SELECT path FROM memories WHERE id = ?").get(id);
    return row ? row.path : null;
}
export function memoryByPath(db, filePath) {
    const row = db.raw.prepare("SELECT * FROM memories WHERE path = ?").get(filePath);
    if (!row)
        return null;
    return rowToMemory(row, relatedIds(db, row.id));
}
export function allMemories(db) {
    const rows = db.raw.prepare("SELECT * FROM memories").all();
    return rows.map((row) => rowToMemory(row, relatedIds(db, row.id)));
}
function relatedIds(db, id) {
    const rows = db.raw
        .prepare("SELECT target_id AS id FROM memory_links WHERE source_id = ?")
        .all(id);
    return rows.map((r) => r.id);
}
//# sourceMappingURL=indexer.js.map