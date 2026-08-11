import type { Memory, MemoryType } from "./types.js";
import { isMemoryStatus, isConfidence } from "./types.js";
import type { MemoryContext } from "./context.js";
import { assertSafeContent, ContentSafetyError } from "./validate.js";
import { markdownNote } from "../vault/frontmatter.js";
import { atomicWriteFile, deleteFile, memoryFilePath } from "../vault/writer.js";
import { memoryById, memoryPathById, upsertMemoryIndex } from "../db/indexer.js";
import { readMemoryNote } from "../vault/reader.js";
import { relatedSection, normalizeRelated } from "./create.js";
import { logger } from "../config.js";

export interface UpdateInput {
  id: string;
  title?: string;
  content?: string;
  type?: MemoryType;
  status?: string;
  confidence?: string;
  tags?: string[];
  project?: string;
  related?: string[];
}

export interface UpdateResult {
  memory: Memory;
  path: string;
  changed: boolean;
}

export function updateMemory(ctx: MemoryContext, input: UpdateInput): UpdateResult {
  const current = memoryById(ctx.db, input.id);
  if (!current) {
    throw new ContentSafetyError(`Memory not found: ${input.id}`);
  }
  const oldPath = memoryPathById(ctx.db, input.id);
  if (!oldPath) {
    throw new ContentSafetyError(`Memory ${input.id} has no indexed path`);
  }

  // Concurrency safety: re-read the file right before mutating so we build on
  // the latest state instead of an agent's stale read.
  const fresh = readMemoryNote(oldPath);
  const next: Memory = { ...fresh.memory };

  const title = input.title?.trim();
  if (title !== undefined && title !== "") {
    assertSafeContent(title, "title");
    next.title = title;
  }
  if (input.content !== undefined) {
    assertSafeContent(input.content, "content");
    next.content = input.content.trim();
  }
  if (input.type !== undefined) {
    next.type = input.type;
  }
  if (input.status !== undefined) {
    if (!isMemoryStatus(input.status)) {
      throw new ContentSafetyError(`Invalid status '${input.status}'`);
    }
    next.status = input.status;
  }
  if (input.confidence !== undefined) {
    if (!isConfidence(input.confidence)) {
      throw new ContentSafetyError(`Invalid confidence '${input.confidence}'`);
    }
    next.confidence = input.confidence;
  }
  if (input.tags !== undefined) {
    const tags = [...new Set(input.tags.map((t) => t.trim()).filter((t) => t !== ""))];
    if (tags.some((t) => /(password|secret|api.?key)\s*[=:]/i.test(t))) {
      throw new ContentSafetyError("Tags must not contain secrets");
    }
    next.tags = tags;
  }
  if (input.project !== undefined) {
    const p = input.project.trim();
    next.project = p === "" ? undefined : p;
  }

  const relatedIds = input.related !== undefined
    ? normalizeRelated(ctx, input.related)
    : current.related;

  const changed =
    next.title !== current.title ||
    next.content !== current.content ||
    next.type !== current.type ||
    next.status !== current.status ||
    next.confidence !== current.confidence ||
    next.project !== current.project ||
    JSON.stringify(next.tags) !== JSON.stringify(current.tags) ||
    JSON.stringify(relatedIds) !== JSON.stringify(current.related);

  let finalPath = oldPath;

  if (changed) {
    next.updatedAt = new Date().toISOString();
    const note = relatedSection(ctx, relatedIds);
    const body = stripRelatedSection(next.content) + (note.text ? `\n\n${note.text}` : "");
    const serialized = markdownNote({ ...next, content: body });

    const targetPath = memoryFilePath(ctx.root, next.type, next.title, next.id);
    if (targetPath !== oldPath) {
      atomicWriteFile(targetPath, serialized);
      deleteFile(oldPath);
      finalPath = targetPath;
    } else {
      atomicWriteFile(oldPath, serialized);
    }

    upsertMemoryIndex(ctx.db, { ...next, content: body }, body, note.wikilinks, finalPath);
    logger.info(`update: ${next.id} (${next.title})`);
  }

  return { memory: { ...next, related: relatedIds }, path: finalPath, changed };
}

function stripRelatedSection(content: string): string {
  return content.replace(/\n?^## Related\n?$/gm, "").trim();
}
