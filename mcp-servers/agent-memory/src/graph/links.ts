import type { MemoryDatabase } from "../db/database.js";

export interface Wikilink {
  label: string;
  alias?: string;
}

const WIKILINK_RE = /\[\[([^\[\]]+?)\]\]/g;

export function extractWikilinks(content: string): Wikilink[] {
  const links: Wikilink[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(WIKILINK_RE)) {
    const inner = match[1];
    if (!inner) continue;
    const targetPart = inner.split("|", 2)[0];
    if (targetPart === undefined) continue;
    const label = targetPart.trim().replace(/^\.\//, "");
    if (label === "") continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const alias = inner.split("|", 2)[1];
    links.push({ label, alias: alias ? alias.trim() : undefined });
  }
  return links;
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export function linkTargetKey(label: string): string {
  // "Notes/Some Note" -> "some note"
  const parts = label.split("/");
  const base = parts[parts.length - 1] ?? label;
  return normalizeTitle(base.replace(/\.md$/i, ""));
}

export interface TitleIndex {
  byNormalized: Map<string, string>;
  byId: Map<string, string>;
}

export function buildTitleIndex(
  db: MemoryDatabase,
): TitleIndex {
  const byNormalized = new Map<string, string>();
  const byId = new Map<string, string>();
  const rows = db.raw
    .prepare("SELECT id, title FROM memories")
    .all() as Array<{ id: string; title: string }>;
  for (const row of rows) {
    byId.set(row.id, row.title);
    const key = normalizeTitle(row.title);
    if (!byNormalized.has(key)) byNormalized.set(key, row.id);
  }
  return { byNormalized, byId };
}

export function resolveWikilinkTargets(
  links: Wikilink[],
  index: TitleIndex,
): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();
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

export function replaceLinks(
  db: MemoryDatabase,
  sourceId: string,
  targetIds: string[],
  relation: string,
): void {
  db.raw.prepare("DELETE FROM memory_links WHERE source_id = ? AND relation = ?").run(sourceId, relation);
  addLinks(db, sourceId, targetIds, relation);
}

export function addLinks(
  db: MemoryDatabase,
  sourceId: string,
  targetIds: string[],
  relation: string,
): void {
  const stmt = db.raw.prepare(
    "INSERT OR IGNORE INTO memory_links (source_id, target_id, relation) VALUES (?, ?, ?)",
  );
  for (const targetId of targetIds) {
    if (targetId === sourceId) continue;
    stmt.run(sourceId, targetId, relation);
  }
}

export function outboundIds(
  db: MemoryDatabase,
  sourceId: string,
  relations?: string[],
): Array<{ id: string; relation: string }> {
  const where = relations && relations.length > 0
    ? ` AND relation IN (${relations.map(() => "?").join(",")})`
    : "";
  const params: Array<string | number | null> = [sourceId, ...(relations ?? [])];
  return db.raw
    .prepare(
      `SELECT target_id AS id, relation FROM memory_links WHERE source_id = ?${where}`,
    )
    .all(...params) as Array<{ id: string; relation: string }>;
}

export function inboundIds(
  db: MemoryDatabase,
  targetId: string,
): Array<{ id: string; relation: string }> {
  return db.raw
    .prepare("SELECT source_id AS id, relation FROM memory_links WHERE target_id = ?")
    .all(targetId) as Array<{ id: string; relation: string }>;
}

export function linkCount(db: MemoryDatabase, id: string): number {
  const row = db.raw
    .prepare(
      "SELECT (SELECT count(*) FROM memory_links WHERE source_id = ?) + (SELECT count(*) FROM memory_links WHERE target_id = ?) AS c",
    )
    .get(id, id) as { c: number };
  return row.c;
}
