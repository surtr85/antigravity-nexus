import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { makeTempVault, cleanup } from "./helpers.js";
import { rememberMemory } from "../src/memory/create.js";
import { MemoryDatabase } from "../src/db/database.js";
import { FtsSemanticSearch } from "../src/search/search.js";
import { detectMemoryRoot, ensureMemoryTree } from "../src/vault/reader.js";
import { countMemories, fullReindex, memoryById } from "../src/db/indexer.js";

const vaults: string[] = [];
afterEach(() => {
  while (vaults.length > 0) fs.rmSync(vaults.pop() as string, { recursive: true, force: true });
});

describe("recovery", () => {
  it("rebuilds a deleted SQLite database from the markdown vault with identical counts", async () => {
    const vault = makeTempVault();
    vaults.push(vault);
    const dbPath = path.join(vault, ".agent-memory", "index.db");
    const root = detectMemoryRoot(vault);
    ensureMemoryTree(root);

    const db1 = MemoryDatabase.open({ dbPath });
    const ctx1 = { vaultPath: vault, root, db: db1, search: new FtsSemanticSearch(db1) };
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await rememberMemory(ctx1, {
        type: i % 2 === 0 ? "fact" : "lesson",
        title: `Rebuild topic ${i}`,
        content: `Content body for rebuild topic ${i} with some detail.`,
        project: "homelab",
        tags: [`tag${i}`],
      });
      ids.push(r.memoryId);
    }
    const before = countMemories(db1);
    expect(before).toBe(5);
    db1.close();

    // destroy the database
    for (const suffix of ["", "-wal", "-shm"]) {
      const f = dbPath + suffix;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    expect(fs.existsSync(dbPath)).toBe(false);

    // reopen and rebuild from markdown
    const db2 = MemoryDatabase.open({ dbPath });
    const ctx2 = { vaultPath: vault, root, db: db2, search: new FtsSemanticSearch(db2) };
    const report = fullReindex(db2, vault);
    expect(report.indexed).toBe(5);
    expect(countMemories(db2)).toBe(before);
    for (const id of ids) {
      expect(memoryById(db2, id)?.id).toBe(id);
    }

    // search works again
    const results = await ctx2.search.search("rebuild topic", { limit: 10 });
    expect(results.length).toBeGreaterThanOrEqual(5);
    db2.close();
  });
});