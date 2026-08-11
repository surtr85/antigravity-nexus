import { MEMORY_TYPES } from "./types.js";
import fs from "node:fs";
export function computeStats(ctx) {
    const db = ctx.db.raw;
    const totalRow = db.prepare("SELECT count(*) AS c FROM memories").get();
    const byType = {};
    for (const type of MEMORY_TYPES)
        byType[type] = 0;
    const typeRows = db.prepare("SELECT type, count(*) AS c FROM memories GROUP BY type").all();
    for (const row of typeRows)
        byType[row.type] = row.c;
    const byProject = {};
    const projectRows = db.prepare("SELECT project, count(*) AS c FROM memories WHERE project IS NOT NULL GROUP BY project").all();
    for (const row of projectRows)
        byProject[row.project] = row.c;
    const tagCounts = new Map();
    const tagRows = db.prepare("SELECT tags_json FROM memories").all();
    for (const row of tagRows) {
        try {
            const tags = JSON.parse(row.tags_json);
            for (const t of tags) {
                if (t)
                    tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
            }
        }
        catch {
            // ignore JSON parse error in malformed legacy rows
        }
    }
    const topTags = Object.fromEntries([...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
    const active = countWhere(db, "status = 'active'");
    const deprecated = countWhere(db, "status = 'deprecated'");
    const unresolved = countWhere(db, "status = 'unresolved'");
    const verified = countWhere(db, "status = 'verified'");
    const recent = db.prepare("SELECT id, title, type, updated_at AS updated FROM memories ORDER BY updated_at DESC LIMIT 10").all();
    const edgesRow = db.prepare("SELECT count(*) AS c FROM memory_links").get();
    const lastIndexedRow = db.prepare("SELECT value FROM meta WHERE key = 'last_indexed'").get();
    let databaseSize = 0;
    const p = ctx.db.path;
    if (p !== ":memory:") {
        try {
            databaseSize = fs.statSync(p).size;
        }
        catch {
            databaseSize = 0;
        }
    }
    const indexStatus = totalRow.c > 0 ? "indexed" : "empty";
    return {
        total: totalRow.c,
        byType,
        byProject,
        topTags,
        active,
        deprecated,
        unresolved,
        verified,
        recent,
        graphNodes: totalRow.c,
        graphEdges: edgesRow.c,
        databaseSize,
        lastIndexed: lastIndexedRow?.value ?? null,
        indexStatus,
    };
}
function countWhere(db, where) {
    const row = db.prepare(`SELECT count(*) AS c FROM memories WHERE ${where}`).get();
    return row.c;
}
//# sourceMappingURL=stats.js.map