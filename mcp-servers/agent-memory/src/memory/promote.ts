import type { Memory, MemoryType } from "./types.js";
import { EVOLUTION_CHAIN } from "./types.js";
import type { MemoryContext } from "./context.js";
import { ContentSafetyError, assertSafeContent } from "./validate.js";
import { memoryById, upsertMemoryIndex } from "../db/indexer.js";
import { createFileExclusive, generateId, memoryFilePath } from "../vault/writer.js";
import { memoryDirFor } from "../vault/reader.js";
import { markdownNote } from "../vault/frontmatter.js";
import { addLinks } from "../graph/links.js";
import { logger } from "../config.js";

export interface PromoteInput {
  ids: string[];
  targetType: "lesson" | "pattern" | "skill";
  title: string;
  content: string;
  confidence?: "high" | "medium" | "low";
}

export interface PromoteResult {
  memory: Memory;
  path: string;
  derivedFrom: string[];
}

export function promoteMemory(ctx: MemoryContext, input: PromoteInput): PromoteResult {
  const targetType = input.targetType;
  const targetRank = EVOLUTION_CHAIN.indexOf(targetType);
  if (targetRank === -1) {
    throw new ContentSafetyError(
      `targetType must be one of: ${EVOLUTION_CHAIN.join(", ")}`,
    );
  }
  const title = input.title.trim();
  const content = input.content.trim();
  if (title === "") throw new ContentSafetyError("Title must not be empty");
  assertSafeContent(title, "title");
  assertSafeContent(content, "content");

  const sources: Memory[] = [];
  for (const id of input.ids) {
    const memory = memoryById(ctx.db, id);
    if (!memory) throw new ContentSafetyError(`Source memory not found: ${id}`);
    sources.push(memory);
  }
  if (sources.length === 0) {
    throw new ContentSafetyError("At least one source memory is required");
  }

  const chainRanks = new Map<string, number>();
  EVOLUTION_CHAIN.forEach((t, i) => chainRanks.set(t, i));
  for (const source of sources) {
    const rank = chainRanks.get(source.type);
    if (rank !== undefined && rank >= targetRank) {
      throw new ContentSafetyError(
        `Cannot promote '${source.title}' (${source.type}) into ${targetType}: ` +
          `promotion moves strictly upward in ${EVOLUTION_CHAIN.join(" → ")}`,
      );
    }
  }

  const now = new Date().toISOString();
  const id = generateId();

  const derived = sources.map((m) => `- [[${m.title}]]`).join("\n");
  const provenance = `## Derived from\n\n${derived}`;
  const fullContent = `${content}\n\n${provenance}`;

  const sourceTags = [...new Set(sources.flatMap((s) => s.tags ?? []))];
  const inferredConfidence = input.confidence ??
    (sources.filter((s) => s.confidence === "high").length >= 2 ? "high" : "medium");

  const memory: Memory = {
    id,
    type: targetType,
    title,
    content: fullContent,
    confidence: inferredConfidence,
    status: "active",
    createdAt: now,
    updatedAt: now,
    source: "promote",
    tags: sourceTags.slice(0, 10),
    related: sources.map((s) => s.id),
  };

  const filePath = memoryFilePath(ctx.root, targetType, title, id);
  createFileExclusive(filePath, markdownNote(memory));
  upsertMemoryIndex(ctx.db, memory, fullContent, [], filePath);
  addLinks(ctx.db, id, sources.map((s) => s.id), "derived_from");
  logger.info(`promote: created ${targetType} ${id} (${title}) from ${sources.length} sources in ${memoryDirFor(ctx.root, targetType)}`);
  return { memory, path: filePath, derivedFrom: sources.map((s) => s.id) };
}
