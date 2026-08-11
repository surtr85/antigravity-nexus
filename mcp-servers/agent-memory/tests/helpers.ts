import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MemoryDatabase } from "../src/db/database.js";
import { detectMemoryRoot, ensureMemoryTree, listMemoryFiles } from "../src/vault/reader.js";
import { FtsSemanticSearch } from "../src/search/search.js";
import type { MemoryContext } from "../src/memory/context.js";

export interface TestContext {
  vault: string;
  dbPath: string;
  root: string;
  db: MemoryDatabase;
  ctx: MemoryContext;
}

export function makeTempVault(prefix = "agent-memory-test-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return dir;
}

export function makeContext(opts: { vault?: string; dbPath?: string } = {}): TestContext {
  const vault = opts.vault ?? makeTempVault();
  const dbPath = opts.dbPath ?? path.join(vault, ".agent-memory", "test.db");
  const db = MemoryDatabase.open({ dbPath });
  const root = detectMemoryRoot(vault);
  ensureMemoryTree(root);
  const ctx: MemoryContext = { vaultPath: vault, root, db, search: new FtsSemanticSearch(db) };
  return { vault, dbPath, root, db, ctx };
}

export function cleanup(ctx: TestContext): void {
  try {
    ctx.db.close();
  } catch {
    // already closed
  }
  fs.rmSync(ctx.vault, { recursive: true, force: true });
}

export function memoryFiles(root: string): string[] {
  return listMemoryFiles(root);
}

export { path };