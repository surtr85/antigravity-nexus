import type { Memory } from "../memory/types.js";
import type { MemoryDatabase } from "./database.js";
import type { Wikilink } from "../graph/links.js";
import { buildTitleIndex, replaceLinks, resolveWikilinkTargets } from "../graph/links.js";
import { scanVault } from "../vault/scanner.js";

export interface IndexedMemoryRow {
  id: string;
  path: string;
  type: string;
  title: string;
  content: string;
  project: string | null;
  confidence: string;
  status: string;
  created_at: string;
  updated_at: string;
  source: string | null;
  source_session: string | null;
  tags_json: string;
}

export function rowToMemory(row: IndexedMemoryRow, related: string[] = []): Memory {
  return {
    id: row.id,
    type: row.type as Memory["type"],
    title: row.title,
    content: row.content,
    project: row.project ?? undefined,
    confidence: row.confidence as Memory["confidence"],
    status: row.status as Memory["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: row.source ?? undefined,
    sourceSession: row.source_session ?? undefined,
    tags: JSON.parse(row.tags_json) as string[],
    related,
  };
}

function normalizeTitleForIndex(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export function upsertMemoryIndex(
  db: MemoryDatabase,
  memory: Memory,
  content: string,
  wikilinks: Wikilink[],
  filePath: string,
): void {
  const tagsJson = JSON.stringify(memory.tags);
  db.withTransaction(() => {
    db.raw
      .prepare(
        `INSERT INTO memories
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
           tags_json = excluded.tags_json`,
      )
      .run(
        memory.id,
        filePath,
        memory.type,
        memory.title,
        content,
        memory.project ?? null,
        memory.confidence,
        memory.status,
        memory.createdAt,
        memory.updatedAt,
        memory.source ?? null,
        memory.sourceSession ?? null,
        tagsJson,
      );

    db.raw.prepare("DELETE FROM memory_fts WHERE id = ?").run(memory.id);
    db.raw
      .prepare("INSERT INTO memory_fts (id, type, project, title, content, tags) VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        memory.id,
        memory.type,
        memory.project ?? "",
        memory.title,
        content,
        memory.tags.join(" "),
      );

    const index = buildTitleIndex(db);
    index.byNormalized.set(normalizeTitleForIndex(memory.title), memory.id);
    index.byId.set(memory.id, memory.title);
    const targets = resolveWikilinkTargets(wikilinks, index);
    replaceLinks(db, memory.id, targets, "related");
  });
}

export function removeMemoryIndex(db: MemoryDatabase, id: string): void {
  db.withTransaction(() => {
    db.raw.prepare("DELETE FROM memory_links WHERE source_id = ? OR target_id = ?").run(id, id);
    db.raw.prepare("DELETE FROM memory_fts WHERE id = ?").run(id);
    db.raw.prepare("DELETE FROM memories WHERE id = ?").run(id);
  });
}

export interface ReindexReport {
  root: string;
  indexed: number;
  invalid: Array<{ filePath: string; error: string }>;
  duplicateIds: Array<{ id: string; paths: string[] }>;
}

export function fullReindex(db: MemoryDatabase, vaultPath: string): ReindexReport {
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

export function countMemories(db: MemoryDatabase): number {
  const row = db.raw.prepare("SELECT count(*) AS c FROM memories").get() as { c: number };
  return row.c;
}

export function memoryById(db: MemoryDatabase, id: string): Memory | null {
  const row = db.raw.prepare("SELECT * FROM memories WHERE id = ?").get(id) as IndexedMemoryRow | undefined;
  if (!row) return null;
  return rowToMemory(row, relatedIds(db, id));
}

export function memoryPathById(db: MemoryDatabase, id: string): string | null {
  const row = db.raw.prepare("SELECT path FROM memories WHERE id = ?").get(id) as { path: string } | undefined;
  return row ? row.path : null;
}

export function memoryByPath(db: MemoryDatabase, filePath: string): Memory | null {  const row = db.raw.prepare("SELECT * FROM memories WHERE path = ?").get(filePath) as IndexedMemoryRow | undefined;
  if (!row) return null;
  return rowToMemory(row, relatedIds(db, row.id));
}

export function allMemories(db: MemoryDatabase): Memory[] {
  const rows = db.raw.prepare("SELECT * FROM memories").all() as unknown as IndexedMemoryRow[];
  return rows.map((row) => rowToMemory(row, relatedIds(db, row.id)));
}

function relatedIds(db: MemoryDatabase, id: string): string[] {
  const rows = db.raw
    .prepare("SELECT target_id AS id FROM memory_links WHERE source_id = ?")
    .all(id) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}
