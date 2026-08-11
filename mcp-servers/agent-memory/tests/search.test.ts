import { describe, it, expect, afterEach } from "vitest";
import { makeContext, cleanup } from "./helpers.js";
import { rememberMemory } from "../src/memory/create.js";
import { forgetMemory } from "../src/memory/delete.js";

const contexts: ReturnType<typeof makeContext>[] = [];
afterEach(() => {
  while (contexts.length > 0) cleanup(contexts.pop() as never);
});

function ctx(): ReturnType<typeof makeContext> {
  const c = makeContext();
  contexts.push(c);
  return c;
}

async function seedBasic(c: ReturnType<typeof makeContext>): Promise<void> {
  await rememberMemory(c.ctx, {
    type: "fact",
    title: "DNS server architecture",
    content: "The homelab uses AdGuard Home on a dedicated VM for filtering.",
    project: "homelab",
    tags: ["dns"],
  });
  await rememberMemory(c.ctx, {
    type: "fact",
    title: "Database backups",
    content: "Backups are stored on a separate NAS volume rotated daily.",
    project: "nas",
    tags: ["backup"],
  });
  await rememberMemory(c.ctx, {
    type: "lesson",
    title: "DNS caching pitfalls",
    content: "systemd-resolved caches stale DNS entries after VPN changes.",
    project: "homelab",
    tags: ["dns"],
  });
}

describe("search", () => {
  it("returns exact-match results", async () => {
    const c = ctx();
    await seedBasic(c);
    const results = await c.ctx.search.search("AdGuard Home filtering", { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.title.includes("DNS server"))).toBe(true);
  });

  it("finds partial matches", async () => {
    const c = ctx();
    await seedBasic(c);
    const results = await c.ctx.search.search("stale cache", { limit: 5 });
    expect(results.some((r) => r.title.includes("DNS caching"))).toBe(true);
  });

  it("ranks title matches above body matches", async () => {
    const c = ctx();
    await seedBasic(c);
    const results = await c.ctx.search.search("backups", { limit: 5 });
    const titles = results.map((r) => r.title);
    expect(titles[0]).toBe("Database backups");
  });

  it("filters by project", async () => {
    const c = ctx();
    await seedBasic(c);
    const results = await c.ctx.search.search("dns", { project: "nas", limit: 5 });
    expect(results.every((r) => r.project === "nas")).toBe(true);
  });

  it("filters by memory type", async () => {
    const c = ctx();
    await seedBasic(c);
    const results = await c.ctx.search.search("dns", { types: ["lesson"], limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.type === "lesson")).toBe(true);
  });

  it("ranks deprecated memories below active ones", async () => {
    const c = ctx();
    const a = await rememberMemory(c.ctx, {
      type: "fact",
      title: "Traefik router strategy",
      content: "Traefik uses path-based routing for internal services.",
      project: "homelab",
    });
    const b = await rememberMemory(c.ctx, {
      type: "fact",
      title: "Oldnginx router strategy",
      content: "Previously nginx handled routing for the same services.",
      project: "homelab",
    });
    forgetMemory(c.ctx, b.memoryId, "deprecate", "replaced by traefik");
    const results = await c.ctx.search.search("router strategy routing", { limit: 5 });
    expect(results[0]?.id).toBe(a.memoryId);
    expect(results[0]?.status).toBe("active");
  });
});