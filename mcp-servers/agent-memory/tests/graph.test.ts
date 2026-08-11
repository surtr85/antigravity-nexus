import { describe, it, expect, afterEach } from "vitest";
import { makeContext, cleanup } from "./helpers.js";
import { rememberMemory } from "../src/memory/create.js";
import { extractWikilinks, resolveWikilinkTargets, buildTitleIndex, linkTargetKey } from "../src/graph/links.js";
import { traverseGraph } from "../src/graph/traversal.js";

const contexts: ReturnType<typeof makeContext>[] = [];
afterEach(() => {
  while (contexts.length > 0) cleanup(contexts.pop() as never);
});

function ctx(): ReturnType<typeof makeContext> {
  const c = makeContext();
  contexts.push(c);
  return c;
}

describe("graph", () => {
  it("extracts wikilinks including alias form", () => {
    const links = extractWikilinks("See [[NetworkManager]] and [[DNS|domain resolution]].");
    expect(links).toEqual([
      { label: "NetworkManager", alias: undefined },
      { label: "DNS", alias: "domain resolution" },
    ]);
  });

  it("resolves wikilinks to indexed memory ids", async () => {
    const c = ctx();
    const nm = await rememberMemory(c.ctx, {
      type: "fact",
      title: "NetworkManager",
      content: "The network management daemon on Fedora.",
      project: "homelab",
    });
    const index = buildTitleIndex(c.ctx.db);
    const targets = resolveWikilinkTargets(extractWikilinks("Related: [[NetworkManager]] and [[DNS]]"), index);
    expect(targets).toEqual([nm.memoryId]);
  });

  it("links explicit related memories and follows the graph", async () => {
    const c = ctx();
    const a = await rememberMemory(c.ctx, {
      type: "decision",
      title: "Decision to use AdGuard",
      content: "Chose AdGuard Home for filtering.",
      project: "homelab",
    });
    const b = await rememberMemory(c.ctx, {
      type: "experience",
      title: "AdGuard setup ran smoothly",
      content: "Installation was straightforward.",
      project: "homelab",
      related: [a.memoryId],
    });
    const graph = traverseGraph(c.ctx.db, b.memoryId, 1, 20);
    const titles = graph.nodes.map((n) => n.title);
    expect(titles).toContain("AdGuard setup ran smoothly");
    expect(titles).toContain("Decision to use AdGuard");
    expect(b.action).toBe("created");
  });

  it("respects depth limit", async () => {
    const c = ctx();
    const m1 = await rememberMemory(c.ctx, { type: "fact", title: "Node one", content: "alpha beta gamma delta." });
    const m2 = await rememberMemory(c.ctx, { type: "fact", title: "Node two", content: "epsilon zeta eta theta.", related: [m1.memoryId] });
    const m3 = await rememberMemory(c.ctx, { type: "fact", title: "Node three", content: "iota kappa lambda mu.", related: [m2.memoryId] });
    expect(m3.action).toBe("created");
    const shallow = traverseGraph(c.ctx.db, m3.memoryId, 1, 50);
    expect(shallow.nodes.map((n) => n.title).sort()).toEqual(["Node three", "Node two"]);
    const deep = traverseGraph(c.ctx.db, m3.memoryId, 2, 50);
    expect(deep.nodes.map((n) => n.title).sort()).toEqual(["Node one", "Node three", "Node two"]);
  });

  it("normalizes title keys for link resolution", () => {
    expect(linkTargetKey("Notes/Some Memory.md")).toBe("some memory");
    expect(linkTargetKey("Primes")).toBe("primes");
  });
});