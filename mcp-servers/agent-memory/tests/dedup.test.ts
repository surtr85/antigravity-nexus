import { describe, it, expect, afterEach } from "vitest";
import { makeContext, cleanup } from "./helpers.js";
import { rememberMemory } from "../src/memory/create.js";
import { consolidateMemory } from "../src/memory/consolidate.js";
import { markdownNote } from "../src/vault/frontmatter.js";
import { createFileExclusive } from "../src/vault/writer.js";
import { upsertMemoryIndex } from "../src/db/indexer.js";
import { extractWikilinks } from "../src/graph/links.js";
import type { Memory } from "../src/memory/types.js";

const contexts: ReturnType<typeof makeContext>[] = [];
afterEach(() => {
  while (contexts.length > 0) cleanup(contexts.pop() as never);
});

function ctx(): ReturnType<typeof makeContext> {
  const c = makeContext();
  contexts.push(c);
  return c;
}

describe("deduplication", () => {
  it("exact duplicate returns unchanged", async () => {
    const c = ctx();
    const first = await rememberMemory(c.ctx, {
      type: "fact",
      title: "Vault encryption method",
      content: "LUKS2 with a passphrase and a detached header on the backup disk.",
      project: "nas",
    });
    const second = await rememberMemory(c.ctx, {
      type: "fact",
      title: "Vault encryption method",
      content: "LUKS2 with a passphrase and a detached header on the backup disk.",
      project: "nas",
    });
    expect(second.action).toBe("unchanged");
    expect(second.memoryId).toBe(first.memoryId);
  });

  it("same concept with shorter content updates the existing memory", async () => {
    const c = ctx();
    const first = await rememberMemory(c.ctx, {
      type: "lesson",
      title: "Always fsync before rename",
      content: "Atomic writes must fsync the file descriptor before rename so the rename cannot persist with empty contents.",
      project: "infra",
    });
    const second = await rememberMemory(c.ctx, {
      type: "lesson",
      title: "Always fsync before rename",
      content: "fsync before rename.",
      project: "infra",
    });
    expect(second.action).toBe("updated");
    expect(second.memoryId).toBe(first.memoryId);
  });

  it("related concept with different context creates a new memory", async () => {
    const c = ctx();
    await rememberMemory(c.ctx, {
      type: "fact",
      title: "Postgres on the NAS",
      content: "PostgreSQL runs as a systemd unit on the NAS.",
      project: "nas",
    });
    const second = await rememberMemory(c.ctx, {
      type: "fact",
      title: "Postgres on the workstation",
      content: "A scratch Postgres instance runs on the dev workstation for experiments.",
      project: "dev",
    });
    expect(second.action).toBe("created");
  });

  it("same title but contradictory content in same project yields conflict", async () => {
    const c = ctx();
    await rememberMemory(c.ctx, {
      type: "fact",
      title: "Backup schedule",
      content: "Backups run every night at 02:00.",
      project: "nas",
    });
    const conflicting = await rememberMemory(c.ctx, {
      type: "fact",
      title: "Backup schedule",
      content: "Backups are disabled entirely until further notice.",
      project: "nas",
    });
    expect(conflicting.action).toBe("conflict");
  });

  it("consolidate detects duplicates and contradictions", async () => {
    const c = ctx();
    const m = (id: string, title: string, content: string): Memory => ({
      id,
      type: "fact",
      title,
      content,
      confidence: "medium",
      status: "active",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      tags: ["wireguard"],
      related: [],
      project: "homelab",
    });
    const notes = [
      m("11111111", "Wireguard port", "Wireguard listens on UDP 51820 for the homelab tunnel."),
      m("22222222", "Wireguard port", "Wireguard listens on UDP 51820 for the homelab tunnel."),
      m("33333333", "Wireguard port", "Wireguard listens on UDP 9999 instead."),
    ];
    for (const memory of notes) {
      const filePath = `${c.root}/Facts/${memory.title}-${memory.id}.md`;
      createFileExclusive(filePath, markdownNote(memory));
      upsertMemoryIndex(c.ctx.db, memory, memory.content, extractWikilinks(memory.content), filePath);
    }
    const plan = await consolidateMemory(c.ctx, { project: "homelab", dryRun: true });
    expect(plan.duplicates.length).toBeGreaterThan(0);
    expect(plan.contradictions.length).toBeGreaterThan(0);
    expect(plan.candidatesAnalyzed).toBe(3);
  });
});