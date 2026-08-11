import type { MemoryDatabase } from "../db/database.js";
import type { Confidence, MemoryType } from "../memory/types.js";
import { ftsMatchQuery, queryTokens } from "./fts.js";
import { makeSnippet, rankScore } from "./ranking.js";

export interface SearchOptions {
  project?: string;
  types?: MemoryType[];
  tags?: string[];
  minConfidence?: Confidence;
  limit?: number;
  statuses?: string[];
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  project: string | null;
  confidence: string;
  status: string;
  updatedAt: string;
  score: number;
  snippet: string;
  tags: string[];
  related: string[];
}

export interface SemanticSearch {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

export const STATUS_PENALTY: Record<string, number> = {
  active: 2.0,
  verified: 2.0,
  uncertain: 0.0,
  unresolved: 0.0,
  superseded: -3.0,
  deprecated: -6.0,
};

export const CONFIDENCE_BASE: Record<string, number> = {
  high: 0.5,
  medium: 0.0,
  low: -0.5,
};

const CONFIDENCE_LEVEL_ORDER: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

interface FtsRow {
  id: string;
  type: string;
  title: string;
  project: string | null;
  confidence: string;
  status: string;
  created_at: string;
  updated_at: string;
  tags_json: string;
  content: string;
  bm25rank: number;
}

export class FtsSemanticSearch implements SemanticSearch {
  constructor(private db: MemoryDatabase) {}

  search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 5, 50));
    const match = ftsMatchQuery(query);
    const tokens = queryTokens(query);

    if (match === null) {
      return Promise.resolve(this.searchRecent(options, limit, tokens, query));
    }

    const where: string[] = ["memory_fts MATCH ?"];
    const params: Array<string | number | null> = [match];

    if (options.project !== undefined && options.project !== "") {
      where.push("m.project = ?");
      params.push(options.project);
    }
    if (options.types && options.types.length > 0) {
      where.push(`m.type IN (${options.types.map(() => "?").join(",")})`);
      params.push(...options.types);
    }
    if (options.statuses && options.statuses.length > 0) {
      where.push(`m.status IN (${options.statuses.map(() => "?").join(",")})`);
      params.push(...options.statuses);
    }
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        where.push("m.tags_json LIKE ?");
        params.push(`%"${tag}"%`);
      }
    }
    if (options.minConfidence) {
      const minLevel = CONFIDENCE_LEVEL_ORDER[options.minConfidence] ?? 0;
      const allowed = (["low", "medium", "high"] as Confidence[]).filter(
        (c) => (CONFIDENCE_LEVEL_ORDER[c] ?? 0) >= minLevel,
      );
      where.push(`m.confidence IN (${allowed.map(() => "?").join(",")})`);
      params.push(...allowed);
    }

    const sql = `
      SELECT m.id, m.type, m.title, m.project, m.confidence, m.status,
             m.created_at, m.updated_at, m.tags_json, m.content,
             bm25(memory_fts, 0, 0, 0, -6.0, -1.0, -3.0) AS bm25rank
      FROM memory_fts f
      JOIN memories m ON m.id = f.id
      WHERE ${where.join(" AND ")}
      ORDER BY bm25rank ASC
      LIMIT 200
    `;

    const rows = this.db.raw.prepare(sql).all(...params) as unknown as FtsRow[];

    const projectBoost = options.project === undefined;
    const results = rows
      .map((row) => this.toResult(row, tokens, projectBoost, query))
      .sort((a, b) => b.score - a.score);

    return Promise.resolve(results.slice(0, limit));
  }

  private toResult(
    row: FtsRow,
    tokens: string[],
    projectBoostEnabled: boolean,
    rawQuery = "",
  ): SearchResult {
    const projectBoost =
      projectBoostEnabled &&
      row.project !== null &&
      tokens.includes(row.project.toLowerCase());
    const score = rankScore(row, projectBoost, this.db, tokens, rawQuery);
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      project: row.project,
      confidence: row.confidence,
      status: row.status,
      updatedAt: row.updated_at,
      score,
      snippet: makeSnippet(row.content, tokens),
      tags: JSON.parse(row.tags_json) as string[],
      related: [],
    };
  }

  private searchRecent(options: SearchOptions, limit: number, tokens: string[], rawQuery = ""): SearchResult[] {
    const where: string[] = ["1=1"];
    const params: Array<string | number | null> = [];
    if (options.project !== undefined && options.project !== "") {
      where.push("project = ?");
      params.push(options.project);
    }
    if (options.types && options.types.length > 0) {
      where.push(`type IN (${options.types.map(() => "?").join(",")})`);
      params.push(...options.types);
    }
    if (options.statuses && options.statuses.length > 0) {
      where.push(`status IN (${options.statuses.map(() => "?").join(",")})`);
      params.push(...options.statuses);
    }
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        where.push("tags_json LIKE ?");
        params.push(`%"${tag}"%`);
      }
    }
    if (options.minConfidence) {
      const minLevel = CONFIDENCE_LEVEL_ORDER[options.minConfidence] ?? 0;
      const allowed = (["low", "medium", "high"] as Confidence[]).filter(
        (c) => (CONFIDENCE_LEVEL_ORDER[c] ?? 0) >= minLevel,
      );
      where.push(`confidence IN (${allowed.map(() => "?").join(",")})`);
      params.push(...allowed);
    }

    const rows = this.db.raw
      .prepare(
        `SELECT id, type, title, project, confidence, status,
                created_at, updated_at, tags_json, content
         FROM memories
         WHERE ${where.join(" AND ")}
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(...params, limit) as unknown as Omit<FtsRow, "bm25rank">[];

    return rows.map((row) =>
      this.toResult({ ...row, bm25rank: 0 }, tokens, false, rawQuery),
    );
  }
}
