import type { MemoryContext } from "./context.js";
import type { Memory } from "./types.js";
import { memoryById } from "../db/indexer.js";

export interface TimelineOptions {
  query?: string;
  project?: string;
  limit?: number;
}

export interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  project: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function timelineMemory(
  ctx: MemoryContext,
  options: TimelineOptions = {},
): Promise<TimelineEntry[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));

  if (options.query && options.query.trim() !== "") {
    const results = await ctx.search.search(options.query, {
      project: options.project,
      limit: 100,
    });
    const entries: TimelineEntry[] = [];
    for (const r of results) {
      const memory = memoryById(ctx.db, r.id);
      if (!memory) continue;
      entries.push(toEntry(memory));
    }
    entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return entries.slice(0, limit);
  }

  const where: string[] = ["1=1"];
  const params: Array<string | number | null> = [];
  if (options.project && options.project !== "") {
    where.push("project = ?");
    params.push(options.project);
  }
  const rows = ctx.db.raw
    .prepare(
      `SELECT id, type, title, project, status, created_at, updated_at
       FROM memories WHERE ${where.join(" AND ")}
       ORDER BY created_at ASC LIMIT ?`,
    )
    .all(...params, limit) as Array<{
    id: string;
    type: string;
    title: string;
    project: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    project: r.project,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function toEntry(memory: Memory): TimelineEntry {
  return {
    id: memory.id,
    type: memory.type,
    title: memory.title,
    project: memory.project ?? null,
    status: memory.status,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}
