import { describe, it, expect, afterEach } from "vitest";
import { makeContext, cleanup } from "./helpers.js";
import { rememberMemory } from "../src/memory/create.js";
import { promoteMemory } from "../src/memory/promote.js";
import { memoryById, memoryPathById } from "../src/db/indexer.js";
import { outboundIds } from "../src/graph/links.js";
import { ContentSafetyError } from "../src/memory/validate.js";

const contexts: ReturnType<typeof makeContext>[] = [];
afterEach(() => {
  while (contexts.length > 0) cleanup(contexts.pop() as never);
});

function ctx(): ReturnType<typeof makeContext> {
  const c = makeContext();
  contexts.push(c);
  return c;
}

describe("lifecycle: experience -> lesson -> pattern -> skill", () => {
  it("promotes experiences to a lesson with provenance", async () => {
    const c = ctx();
    const e1 = await rememberMemory(c.ctx, {
      type: "experience",
      title: "Helper binaries missing on first run",
      content: "Had to set a helper env var before tests ran.",
      project: "ci",
    });
    const e2 = await rememberMemory(c.ctx, {
      type: "experience",
      title: "Env var vanished again today",
      content: "The same helper env var was missing again today.",
      project: "ci",
    });
    expect(e2.action).toBe("created");
    const lesson = promoteMemory(c.ctx, {
      ids: [e1.memoryId, e2.memoryId],
      targetType: "lesson",
      title: "Set helper env before tests",
      content: "Always set the helper env var before running integration tests.",
    });
    expect(lesson.memory.type).toBe("lesson");
    const stored = memoryById(c.ctx.db, lesson.memory.id);
    expect(stored?.content).toContain("## Derived from");
    expect(stored?.content).toContain("[[Helper binaries missing on first run]]");
    const links = outboundIds(c.ctx.db, lesson.memory.id);
    expect(links.map((l) => l.id).sort()).toEqual([e1.memoryId, e2.memoryId].sort());
  });

  it("forbids demoting or skipping backwards", async () => {
    const c = ctx();
    const e = await rememberMemory(c.ctx, {
      type: "experience",
      title: "A single event",
      content: "Something happened once.",
      project: "ci",
    });
    expect(() =>
      promoteMemory(c.ctx, { ids: [e.memoryId], targetType: "lesson", title: "Nope", content: "x" }),
    ).not.toThrow();
    expect(() =>
      promoteMemory(c.ctx, { ids: [e.memoryId], targetType: "experience", title: "Nope", content: "x" }),
    ).toThrow();
  });

  it("promotes lesson -> pattern and pattern -> skill, preserving chain", async () => {
    const c = ctx();
    const e = await rememberMemory(c.ctx, {
      type: "experience",
      title: "Test env init struggle",
      content: "Env lacking again for integration tests.",
      project: "ci",
    });
    const l = promoteMemory(c.ctx, {
      ids: [e.memoryId],
      targetType: "lesson",
      title: "Init test env first",
      content: "Initialize the environment before any test run.",
    });
    const p = promoteMemory(c.ctx, {
      ids: [l.memory.id],
      targetType: "pattern",
      title: "Test env bootstrap pattern",
      content: "A small bootstrap step should always precede integration tests.",
    });
    const s = promoteMemory(c.ctx, {
      ids: [p.memory.id],
      targetType: "skill",
      title: "Integration test initialization",
      content: "Proven procedure to initialize integration test environments.",
    });
    expect(memoryById(c.ctx.db, s.memory.id)?.type).toBe("skill");
    expect(outboundIds(c.ctx.db, s.memory.id, ["derived_from"]).map((x) => x.id)).toContain(p.memory.id);
    expect(memoryPathById(c.ctx.db, s.memory.id)).toContain("Skills/");
  });

  it("promoting a pattern into a lesson errors (chain not respected)", async () => {
    const c = ctx();
    const e = await rememberMemory(c.ctx, {
      type: "experience",
      title: "Env issue",
      content: "Env missing.",
      project: "ci",
    });
    const l = promoteMemory(c.ctx, {
      ids: [e.memoryId],
      targetType: "lesson",
      title: "Env first",
      content: "Set env first.",
    });
    const p = promoteMemory(c.ctx, {
      ids: [l.memory.id],
      targetType: "pattern",
      title: "Env pattern",
      content: "Pattern for setting env.",
    });
    expect(() =>
      promoteMemory(c.ctx, { ids: [p.memory.id], targetType: "lesson", title: "Bad", content: "x" }),
    ).toThrow(ContentSafetyError);
  });
});