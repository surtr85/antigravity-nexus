import type { MemoryContext } from "./context.js";
import { MEMORY_TYPES } from "./types.js";
import type { MemoryDatabase } from "../db/database.js";
import fs from "node:fs";

export interface MemoryStats {
  total: number;
  byType: Record<string, number>;
  byProject: Record<string, number>;
  topTags: Record<string, number>;
  active: number;
  deprecated: number;
  unresolved: number;
  verified: number;
  recent: Array<{ id: string; title: string; type: string; updated: string }>;
  graphNodes: number;
  graphEdges: number;
  databaseSize: number;
  lastIndexed: string | null;
  indexStatus: string;
}

export function computeStats(ctx: MemoryContext): MemoryStats {
  const db = ctx.db.raw;

  const totalRow = db.prepare("SELECT count(*) AS c FROM memories").get() as { c: number };
  const byType: Record<string, number> = {};
  for (const type of MEMORY_TYPES) byType[type] = 0;
  const typeRows = db.prepare("SELECT type, count(*) AS c FROM memories GROUP BY type").all() as Array<{ type: string; c: number }>;
  for (const row of typeRows) byType[row.type] = row.c;

  const byProject: Record<string, number> = {};
  const projectRows = db.prepare("SELECT project, count(*) AS c FROM memories WHERE project IS NOT NULL GROUP BY project").all() as Array<{ project: string; c: number }>;
  for (const row of projectRows) byProject[row.project] = row.c;

  const tagCounts = new Map<string, number>();
  const tagRows = db.prepare("SELECT tags_json FROM memories").all() as Array<{ tags_json: string }>;
  for (const row of tagRows) {
    try {
      const tags = JSON.parse(row.tags_json) as string[];
      for (const t of tags) {
        if (t) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    } catch {
      // ignore JSON parse error in malformed legacy rows
    }
  }
  const topTags: Record<string, number> = Object.fromEntries(
    [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
  );

  const active = countWhere(db, "status = 'active'");
  const deprecated = countWhere(db, "status = 'deprecated'");
  const unresolved = countWhere(db, "status = 'unresolved'");
  const verified = countWhere(db, "status = 'verified'");

  const recent = (db.prepare("SELECT id, title, type, updated_at AS updated FROM memories ORDER BY updated_at DESC LIMIT 10").all() as Array<{ id: string; title: string; type: string; updated: string }>);

  const edgesRow = db.prepare("SELECT count(*) AS c FROM memory_links").get() as { c: number };
  const lastIndexedRow = db.prepare("SELECT value FROM meta WHERE key = 'last_indexed'").get() as { value: string } | undefined;

  let databaseSize = 0;
  const p = ctx.db.path;
  if (p !== ":memory:") {
    try {
      databaseSize = fs.statSync(p).size;
    } catch {
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

function countWhere(db: MemoryDatabase["raw"], where: string): number {
  const row = db.prepare(`SELECT count(*) AS c FROM memories WHERE ${where}`).get() as { c: number };
  return row.c;
}
