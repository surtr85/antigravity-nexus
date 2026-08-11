import type { Memory, MemoryType } from "./types.js";
import { EVOLUTION_CHAIN } from "./types.js";
import type { MemoryContext } from "./context.js";
import { allMemories, memoryById } from "../db/indexer.js";
import { titleSimilarity, contentSimilarity, wordContainment } from "./dedup.js";
import { detectContradictions } from "./dedup.js";
import { createFileExclusive, generateId, memoryFilePath } from "../vault/writer.js";
import { memoryDirFor } from "../vault/reader.js";
import { markdownNote } from "../vault/frontmatter.js";
import { upsertMemoryIndex, memoryPathById } from "../db/indexer.js";
import { addLinks, replaceLinks } from "../graph/links.js";
import { relatedSection } from "./create.js";
import { logger } from "../config.js";

export interface ConsolidateOptions {
  query?: string;
  project?: string;
  ids?: string[];
  dryRun?: boolean;
}

export interface DuplicateGroup {
  ids: string[];
  similarity: number;
  reason: string;
}

export interface ConsolidationPlan {
  duplicates: DuplicateGroup[];
  mergeCandidates: DuplicateGroup[];
  contradictions: Array<{ a: string; b: string; similarity: number }>;
  repeatedExperiences: Array<{ ids: string[]; suggestedTitle: string }>;
  patterns: Array<{ ids: string[]; suggestedTitle: string }>;
  skillCandidates: Array<{ ids: string[]; suggestedTitle: string }>;
  stale: Array<{ id: string; title: string; status: string; updatedAt: string }>;
  candidatesAnalyzed: number;
}

export async function consolidateMemory(
  ctx: MemoryContext,
  options: ConsolidateOptions = {},
): Promise<ConsolidationPlan> {
  const memories = await gatherCandidates(ctx, options);

  const duplicates: DuplicateGroup[] = [];
  const mergeCandidates: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < memories.length; i++) {
    const a = memories[i] as Memory;
    for (let j = i + 1; j < memories.length; j++) {
      const b = memories[j] as Memory;
      if (a.id === b.id || a.project !== b.project) continue;
      const titleSim = titleSimilarity(a.title, b.title);
      const contentSim = contentSimilarityForConsolidate(a.content, b.content);
      if (titleSim >= 0.9 && (contentSim >= 0.55 || wordContainment(a.content, b.content) >= 0.7)) {
        const key = sortedKey(a.id, b.id);
        if (!seen.has(key)) {
          seen.add(key);
          duplicates.push({
            ids: [a.id, b.id],
            similarity: Math.round((titleSim + contentSim) / 2 * 100) / 100,
            reason: "Duplicate: near-identical title and content",
          });
        }
      } else if (titleSim >= 0.65 && (contentSim >= 0.35 || wordContainment(a.content, b.content) >= 0.6)) {
        const key = sortedKey(a.id, b.id);
        if (!seen.has(key)) {
          seen.add(key);
          mergeCandidates.push({
            ids: [a.id, b.id],
            similarity: Math.round((titleSim + contentSim) / 2 * 100) / 100,
            reason: "Same concept; complementary details could be merged",
          });
        }
      }
    }
  }

  const contradictions = detectContradictions(memories).map((c) => ({
    a: c.a.id,
    b: c.b.id,
    similarity: c.similarity,
  }));

  const repeatedExperiences = groupExperiences(memories, 3, 0.55, "Repeated experiences share the same theme");
  const patterns = groupExperiences(memories, 2, 0.65, "Experience cluster may generalize into a pattern");
  const skillCandidates = groupByType(memories, ["lesson", "pattern"], 3, 0.6, "Lessons/patterns cluster may become a skill");

  const stale = memories
    .filter((m) => m.status === "deprecated" || (m.status === "unresolved" && isStale(m.updatedAt)))
    .map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      updatedAt: m.updatedAt,
    }));

  const plan: ConsolidationPlan = {
    duplicates,
    mergeCandidates,
    contradictions,
    repeatedExperiences,
    patterns,
    skillCandidates,
    stale,
    candidatesAnalyzed: memories.length,
  };

  if (options.dryRun !== false) {
    return plan;
  }

  applyNonDestructive(ctx, plan);
  return plan;
}

function contentSimilarityForConsolidate(a: string, b: string): number {
  if (a.trim() === "" || b.trim() === "") return 0;
  return contentSimilarity(a, b);
}

function isStale(iso: string): boolean {
  const age = (Date.now() - Date.parse(iso)) / 86_400_000;
  return !Number.isNaN(age) && age > 30;
}

function sortedKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function unionFind(ids: string[], minSim: number, simFn: (a: Memory, b: Memory) => number, memories: Map<string, Memory>): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p !== x) {
      parent.set(x, find(p));
    }
    return parent.get(x) ?? x;
  };
  for (const id of ids) parent.set(id, id);
  for (let i = 0; i < ids.length; i++) {
    const idA = ids[i];
    if (idA === undefined) continue;
    for (let j = i + 1; j < ids.length; j++) {
      const idB = ids[j];
      if (idB === undefined) continue;
      const a = memories.get(idA);
      const b = memories.get(idB);
      if (a && b && simFn(a, b) >= minSim) {
        parent.set(find(idA), find(idB));
      }
    }
  }
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    const list = groups.get(root) ?? [];
    list.push(id);
    groups.set(root, list);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

function groupExperiences(
  memories: Memory[],
  minSize: number,
  minSim: number,
  reason: string,
): Array<{ ids: string[]; suggestedTitle: string }> {
  const experiences = memories.filter((m) => m.type === "experience" || m.type === "session");
  const map = new Map(experiences.map((m) => [m.id, m]));
  const groups = unionFind(
    experiences.map((m) => m.id),
    minSim,
    (a, b) => Math.max(titleSimilarity(a.title, b.title), contentSimilarity(a.content, b.content)),
    map,
  );
  return groups
    .filter((g) => g.length >= minSize)
    .map((ids) => ({ ids, suggestedTitle: suggestedTitleFrom(map, ids) }))
    .filter((g) => g.ids.length > 0);
}

function groupByType(
  memories: Memory[],
  types: MemoryType[],
  minSize: number,
  minSim: number,
  reason: string,
): Array<{ ids: string[]; suggestedTitle: string }> {
  const subset = memories.filter((m) => (types as string[]).includes(m.type));
  const map = new Map(subset.map((m) => [m.id, m]));
  const groups = unionFind(
    subset.map((m) => m.id),
    minSim,
    (a, b) => Math.max(titleSimilarity(a.title, b.title), contentSimilarity(a.content, b.content)),
    map,
  );
  return groups
    .filter((g) => g.length >= minSize)
    .map((ids) => ({ ids, suggestedTitle: suggestedTitleFrom(map, ids) }));
}

function suggestedTitleFrom(map: Map<string, Memory>, ids: string[]): string {
  const titles = ids.map((id) => map.get(id)?.title).filter((t): t is string => Boolean(t));
  if (titles.length === 0) return "Untitled cluster";
  const common = commonWords(titles);
  if (common.length > 0) return common.slice(0, 4).join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
  return titles[0] as string;
}

function commonWords(titles: string[]): string[] {
  const counts = new Map<string, number>();
  for (const t of titles) {
    const words = new Set<string>();
    for (const w of t.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (w.length >= 3 && !STOPWORDS.has(w)) words.add(w);
    }
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const result = [...counts.entries()]
    .filter(([, c]) => c >= Math.ceil(titles.length / 2))
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);
  return result;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "was", "were", "have",
  "has", "had", "our", "you", "your", "how", "why", "what", "when", "where",
]);

async function gatherCandidates(ctx: MemoryContext, options: ConsolidateOptions): Promise<Memory[]> {
  if (options.ids && options.ids.length > 0) {
    const out: Memory[] = [];
    for (const id of options.ids) {
      const m = memoryById(ctx.db, id);
      if (m) out.push(m);
    }
    return out;
  }
  if (options.query && options.query.trim() !== "") {
    const results = await ctx.search.search(options.query, { project: options.project, limit: 100 });
    const out: Memory[] = [];
    for (const r of results) {
      const m = memoryById(ctx.db, r.id);
      if (m) out.push(m);
    }
    return out;
  }
  if (options.project) {
    return allMemories(ctx.db).filter((m) => m.project === options.project);
  }
  return allMemories(ctx.db).slice(0, 200);
}

function applyNonDestructive(ctx: MemoryContext, plan: ConsolidationPlan): void {
  const linkPairs: Array<[string, string]> = [];
  for (const group of [...plan.duplicates, ...plan.mergeCandidates]) {
    for (const a of group.ids) {
      for (const b of group.ids) {
        if (a !== b) linkPairs.push([a, b]);
      }
    }
  }
  for (const group of [...plan.patterns, ...plan.skillCandidates, ...plan.repeatedExperiences]) {
    createCandidateMemory(ctx, group.ids, group.suggestedTitle);
  }
  for (const [a, b] of linkPairs) {
    replaceLinks(ctx.db, a, [b], "related");
  }
}

function createCandidateMemory(ctx: MemoryContext, sourceIds: string[], suggestedTitle: string): void {
  const sources = sourceIds.map((id) => memoryById(ctx.db, id)).filter((m): m is Memory => m !== null);
  if (sources.length === 0) return;

  const type: MemoryType = "pattern";
  const now = new Date().toISOString();
  const id = generateId();

  const derived = sources
    .map((m) => `- [[${m.title}]]`)
    .join("\n");

  const memory: Memory = {
    id,
    type,
    title: suggestedTitle,
    content: `Candidate derived from ${sources.length} related memories. Review and refine before use.\n\n## Derived from\n\n${derived}`,
    confidence: "low",
    status: "uncertain",
    createdAt: now,
    updatedAt: now,
    source: "consolidate",
    tags: [...new Set(sources.flatMap((s) => s.tags ?? []))].slice(0, 10),
    related: sourceIds,
  };

  const filePath = memoryFilePath(ctx.root, type, suggestedTitle, id);
  createFileExclusive(filePath, markdownNote(memory));
  upsertMemoryIndex(ctx.db, memory, memory.content, [], filePath);
  addLinks(ctx.db, id, sourceIds, "derived_from");
  logger.info(`consolidate: candidate memory ${id} (${suggestedTitle})`);
}
