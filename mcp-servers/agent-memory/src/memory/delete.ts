import type { MemoryContext } from "./context.js";
import { ContentSafetyError } from "./validate.js";
import { memoryById, memoryPathById, removeMemoryIndex, upsertMemoryIndex } from "../db/indexer.js";
import { readMemoryNote } from "../vault/reader.js";
import { atomicWriteFile, deleteFile } from "../vault/writer.js";
import { markdownNote } from "../vault/frontmatter.js";
import { logger } from "../config.js";

export interface ForgetResult {
  mode: "deprecated" | "deleted";
  memoryId: string;
  path: string;
  status: string;
}

export function forgetMemory(
  ctx: MemoryContext,
  id: string,
  mode: "delete" | "deprecate",
  reason?: string,
): ForgetResult {
  const memory = memoryById(ctx.db, id);
  if (!memory) {
    throw new ContentSafetyError(`Memory not found: ${id}`);
  }
  const path = memoryPathById(ctx.db, id);
  if (!path) {
    throw new ContentSafetyError(`Memory ${id} has no indexed path`);
  }

  if (mode === "delete") {
    deleteFile(path);
    removeMemoryIndex(ctx.db, id);
    logger.info(`forget: deleted ${id}`);
    return { mode: "deleted", memoryId: id, path, status: "deleted" };
  }

  // deprecate (default): non-destructive
  if (memory.status === "deprecated") {
    return { mode: "deprecated", memoryId: id, path, status: "deprecated" };
  }

  const fresh = readMemoryNote(path);
  const next = { ...fresh.memory, status: "deprecated" as const, updatedAt: new Date().toISOString() };

  let content = stripDeprecatedMarker(next.content);
  if (reason && reason.trim() !== "") {
    content = `${content}\n\n**Deprecated:** ${reason.trim()}`;
  }

  atomicWriteFile(path, markdownNote({ ...next, content }));
  upsertMemoryIndex(ctx.db, { ...next, content }, content, fresh.wikilinks, path);
  logger.info(`forget: deprecated ${id}`);
  return { mode: "deprecated", memoryId: id, path, status: "deprecated" };
}

function stripDeprecatedMarker(content: string): string {
  return content.replace(/\n?\*\*Deprecated:\*\*[\s\S]*$/, "").trim();
}
