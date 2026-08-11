import type { MemoryContext } from "./context.js";
import type { Confidence, MemoryType } from "./types.js";
import type { SearchOptions } from "../search/search.js";

export interface RecallOptions {
  project?: string;
  types?: MemoryType[];
  tags?: string[];
  minConfidence?: Confidence;
  limit?: number;
  includeRelated?: boolean;
}

export interface RecallEntry {
  id: string;
  type: string;
  title: string;
  project: string | null;
  confidence: string;
  status: string;
  updated: string;
  score: number;
  snippet: string;
  tags: string[];
  related: string[];
}

export async function recallMemory(
  ctx: MemoryContext,
  query: string,
  options: RecallOptions = {},
): Promise<RecallEntry[]> {
  const searchOptions: SearchOptions = {
    project: options.project,
    types: options.types,
    tags: options.tags,
    minConfidence: options.minConfidence,
    limit: options.limit ?? 5,
  };
  const results = await ctx.search.search(query, searchOptions);
  return results.map((r) => {
    const entry: RecallEntry = {
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

function relatedTitles(ctx: MemoryContext, id: string): string[] {
  const rows = ctx.db.raw
    .prepare(
      `SELECT m.title AS title
       FROM memory_links l JOIN memories m ON m.id = l.target_id
       WHERE l.source_id = ?`,
    )
    .all(id) as Array<{ title: string }>;
  return rows.map((r) => r.title);
}
