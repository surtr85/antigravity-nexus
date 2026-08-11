import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { makeContext, cleanup, memoryFiles } from "./helpers.js";
import { atomicWriteFile, createFileExclusive } from "../src/vault/writer.js";
import { readMemoryNote } from "../src/vault/reader.js";
import { scanVault } from "../src/vault/scanner.js";
import { markdownNote, serializeMemoryFile } from "../src/vault/frontmatter.js";
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

const base: Memory = {
  id: "a1b2c3d4",
  type: "fact",
  title: "Sample fact",
  content: "The sky is blue because of Rayleigh scattering.",
  confidence: "high",
  status: "active",
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  tags: ["physics"],
  related: [],
};

describe("vault", () => {
  it("creates a note file that reads back identically", () => {
    const c = ctx();
    const filePath = path.join(c.root, "Facts", "sample-fact-a1b2c3d4.md");
    createFileExclusive(filePath, markdownNote(base));
    const read = readMemoryNote(filePath);
    expect(read.memory.title).toBe(base.title);
    expect(read.memory.content).toBe(base.content);
    expect(read.memory.id).toBe(base.id);
    expect(read.memory.type).toBe("fact");
    expect(memoryFiles(c.root)).toHaveLength(1);
  });

  it("preserves related section placement on round-trip", () => {
    const c = ctx();
    const mem = { ...base, content: `${base.content}\n\n## Related\n\n- [[Other thing]]` };
    const filePath = path.join(c.root, "Facts", "sample-fact-a1b2c3d4.md");
    createFileExclusive(filePath, markdownNote(mem));
    const read = readMemoryNote(filePath);
    expect(read.memory.content).toContain("[[Other thing]]");
    expect(read.memory.content).toContain("Rayleigh");
  });

  it("atomic write replaces content atomically and leaves no temp files", () => {
    const c = ctx();
    const filePath = path.join(c.root, "Facts", "sample-fact-a1b2c3d4.md");
    createFileExclusive(filePath, markdownNote(base));
    const updated = { ...base, content: "Updated content.", updatedAt: new Date().toISOString() };
    atomicWriteFile(filePath, markdownNote(updated));
    const read = readMemoryNote(filePath);
    expect(read.memory.content).toBe("Updated content.");
    const temps = fs.readdirSync(path.dirname(filePath)).filter((f) => f.includes(".tmp-"));
    expect(temps).toHaveLength(0);
  });

  it("detects malformed frontmatter during scan", () => {
    const c = ctx();
    fs.writeFileSync(
      path.join(c.root, "Facts", "broken.md"),
      "---\nid: [unclosed\ntype: fact\n---\n# Broken\n",
    );
    const scan = scanVault(c.vault);
    expect(scan.invalid.some((i) => i.filePath.includes("broken.md"))).toBe(true);
  });

  it("rejects notes with a duplicate id as invalid", () => {
    const c = ctx();
    for (const dir of ["Facts", "Decisions"]) {
      fs.writeFileSync(path.join(c.root, dir, "note.md"), markdownNote(base));
    }
    const scan = scanVault(c.vault);
    expect(scan.duplicateIds.length).toBeGreaterThan(0);
  });

  it("serializes stable frontmatter ordering without extra whitespace churn", () => {
    const one = serializeMemoryFile(base, "# Sample fact\n\nBody line");
    const two = serializeMemoryFile({ ...base, content: "Body line" }, "# Sample fact\n\nBody line");
    const keyOrder = one.split("\n").filter((l) => l.includes(":") && !l.startsWith("-")).join("|");
    const keyOrder2 = two.split("\n").filter((l) => l.includes(":") && !l.startsWith("-")).join("|");
    expect(keyOrder).toBe(keyOrder2);
    expect(one).toContain("created:");
    expect(one).not.toContain("updated_at");
  });
});