import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { makeContext, cleanup } from "./helpers.js";
import { rememberMemory } from "../src/memory/create.js";
import { recallMemory } from "../src/memory/recall.js";
import { updateMemory } from "../src/memory/update.js";
import { consolidateMemory } from "../src/memory/consolidate.js";
import { traverseGraph } from "../src/graph/traversal.js";
import { fullReindex, countMemories } from "../src/db/indexer.js";

const TEST_VAULT = "/tmp/agent-memory-test-vault";

let c: ReturnType<typeof makeContext>;
let primaryId: string;
let relatedId: string;

beforeAll(() => {
  fs.rmSync(TEST_VAULT, { recursive: true, force: true });
  c = makeContext({ vault: TEST_VAULT, dbPath: path.join(TEST_VAULT, ".agent-memory", "index.db") });
});

afterAll(() => {
  cleanup(c);
});

describe("integration: full journey through /tmp/agent-memory-test-vault", () => {
  it("creates a memory", async () => {
    const r = await rememberMemory(c.ctx, {
      type: "decision",
      title: "Integrate Tailscale ACLs",
      content: "Decided to manage Tailscale ACLs as code in the homelab repo.",
      project: "homelab",
      tags: ["tailscale", "networking"],
      source: "integration-test",
    });
    expect(r.action).toBe("created");
    primaryId = r.memoryId;
  });

  it("searches and finds it", async () => {
    const results = await recallMemory(c.ctx, "tailscale acl policy", { project: "homelab", limit: 3 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toContain("Tailscale");
  });

  it("updates it", async () => {
    const r = updateMemory(c.ctx, { id: primaryId, confidence: "high", tags: ["tailscale", "networking", "iac"] });
    expect(r.memory.confidence).toBe("high");
    expect(r.memory.tags).toContain("iac");
    expect(r.changed).toBe(true);
  });

  it("creates a related memory and follows the graph", async () => {
    const r = await rememberMemory(c.ctx, {
      type: "experience",
      title: "Tailscale ACL gotcha",
      content: "Wildcard tags require approval before they can be referenced in ACLs.",
      project: "homelab",
      related: [primaryId],
    });
    expect(r.action).toBe("created");
    relatedId = r.memoryId;
    const graph = traverseGraph(c.ctx.db, relatedId, 2, 20);
    const titles = graph.nodes.map((n) => n.title);
    expect(titles).toContain("Integrate Tailscale ACLs");
  });

  it("consolidates without destroying data", async () => {
    const plan = await consolidateMemory(c.ctx, { project: "homelab", dryRun: true });
    expect(plan.candidatesAnalyzed).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(plan.duplicates)).toBe(true);
  });

  it("survives a database rebuild with same memory count", async () => {
    const before = countMemories(c.db);
    c.db.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      const f = c.dbPath + suffix;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    const reopened = makeContext({ vault: TEST_VAULT, dbPath: c.dbPath });
    c = reopened;
    const report = fullReindex(reopened.db, TEST_VAULT);
    expect(report.indexed).toBe(before);
    expect(countMemories(reopened.db)).toBe(before);
  });

  it("searches again after the rebuild", async () => {
    const results = await recallMemory(c.ctx, "tailscale acl", { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toContain("Tailscale");
  });
});