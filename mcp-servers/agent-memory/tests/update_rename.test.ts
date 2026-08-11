import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { makeContext, cleanup, memoryFiles } from "./helpers.js";
import { rememberMemory } from "../src/memory/create.js";
import { updateMemory } from "../src/memory/update.js";
import { recallMemory } from "../src/memory/recall.js";
import { traverseGraph } from "../src/graph/traversal.js";
import { readMemoryNote } from "../src/vault/reader.js";

const contexts: ReturnType<typeof makeContext>[] = [];
afterEach(() => {
  while (contexts.length > 0) cleanup(contexts.pop() as never);
});

function ctx(): ReturnType<typeof makeContext> {
  const c = makeContext();
  contexts.push(c);
  return c;
}

describe("update & file relocation", () => {
  it("relocates note when type changes (e.g. fact -> lesson)", async () => {
    const c = ctx();
    const created = await rememberMemory(c.ctx, {
      type: "fact",
      title: "DNS caching gotcha",
      content: "systemd-resolved may keep stale caches.",
      project: "homelab",
    });

    const oldPath = created.path;
    expect(oldPath).toContain("/Facts/");
    expect(fs.existsSync(oldPath)).toBe(true);

    const updated = updateMemory(c.ctx, {
      id: created.memoryId,
      type: "lesson",
    });

    expect(updated.changed).toBe(true);
    expect(updated.path).toContain("/Lessons/");
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(fs.existsSync(updated.path)).toBe(true);

    const note = readMemoryNote(updated.path);
    expect(note.memory.type).toBe("lesson");
    expect(note.memory.id).toBe(created.memoryId);
  });

  it("renames file when title changes", async () => {
    const c = ctx();
    const created = await rememberMemory(c.ctx, {
      type: "fact",
      title: "Initial Title",
      content: "Some content here.",
    });

    const oldPath = created.path;
    expect(oldPath).toContain("initial-title-");

    const updated = updateMemory(c.ctx, {
      id: created.memoryId,
      title: "Completely Brand New Title",
    });

    expect(updated.changed).toBe(true);
    expect(updated.path).toContain("completely-brand-new-title-");
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(fs.existsSync(updated.path)).toBe(true);
  });
});

describe("bidirectional graph backlinks", () => {
  it("discovers backlinks (inbound links) during graph traversal", async () => {
    const c = ctx();
    // Memory A (target)
    const a = await rememberMemory(c.ctx, {
      type: "decision",
      title: "Adopt Traefik",
      content: "Adopted Traefik for reverse proxy.",
    });

    // Memory B (source) links to Memory A
    const b = await rememberMemory(c.ctx, {
      type: "experience",
      title: "Traefik TLS setup",
      content: "Configuring Let's Encrypt certificates with Traefik was smooth.",
      related: [a.memoryId],
    });

    // When traversing from A (which has no explicit outbound links to B),
    // bidirectional traversal (direction="both") or direction="inbound" must discover B!
    const graphBoth = traverseGraph(c.ctx.db, a.memoryId, 1, 20, "both");
    const titlesBoth = graphBoth.nodes.map((n) => n.title);
    expect(titlesBoth).toContain("Adopt Traefik");
    expect(titlesBoth).toContain("Traefik TLS setup");

    const graphInbound = traverseGraph(c.ctx.db, a.memoryId, 1, 20, "inbound");
    const titlesInbound = graphInbound.nodes.map((n) => n.title);
    expect(titlesInbound).toContain("Traefik TLS setup");

    const graphOutbound = traverseGraph(c.ctx.db, a.memoryId, 1, 20, "outbound");
    expect(graphOutbound.nodes.map((n) => n.title)).toEqual(["Adopt Traefik"]);
  });
});

describe("search enhancements", () => {
  it("boosts exact and substring title matches", async () => {
    const c = ctx();
    await rememberMemory(c.ctx, {
      type: "fact",
      title: "Unrelated Note mentioning wireguard in the body",
      content: "We also have wireguard mentioned somewhere deep in the configuration notes.",
    });
    await rememberMemory(c.ctx, {
      type: "fact",
      title: "WireGuard VPN",
      content: "WireGuard mesh networking across nodes.",
    });

    const results = await recallMemory(c.ctx, "WireGuard VPN", { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBe("WireGuard VPN");
  });

  it("filters search by tags", async () => {
    const c = ctx();
    await rememberMemory(c.ctx, {
      type: "fact",
      title: "Server Backup Strategy",
      content: "Nightly restic backups.",
      tags: ["backup", "storage"],
    });
    await rememberMemory(c.ctx, {
      type: "fact",
      title: "Networking Router Config",
      content: "Backup router on cold standby.",
      tags: ["networking"],
    });

    const backupResults = await recallMemory(c.ctx, "backup", { tags: ["storage"] });
    expect(backupResults.every((r) => r.tags.includes("storage"))).toBe(true);
    expect(backupResults.some((r) => r.title === "Server Backup Strategy")).toBe(true);
  });
});
