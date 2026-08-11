import fs from "node:fs";
import path from "node:path";
import { MEMORY_DIRS, MEMORY_DIR_NAMES } from "../memory/types.js";
import type { Memory } from "../memory/types.js";
import type { Wikilink } from "../graph/links.js";
import { extractWikilinks } from "../graph/links.js";
import { memoryFromNote, parseFrontmatter } from "./frontmatter.js";

export const DEFAULT_MEMORY_ROOT = "Agent Memory";

export function detectMemoryRoot(vaultPath: string): string {
  const defaultRoot = path.join(vaultPath, DEFAULT_MEMORY_ROOT);
  if (fs.existsSync(defaultRoot) && fs.statSync(defaultRoot).isDirectory()) {
    return defaultRoot;
  }

  const entries = safeReaddir(vaultPath);
  const typeDirNames = new Set(MEMORY_DIR_NAMES);

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const full = path.join(vaultPath, entry);
    if (!fs.statSync(full).isDirectory()) continue;
    if (typeDirNames.has(entry)) {
      return vaultPath;
    }
    const children = safeReaddir(full);
    const hits = children.filter((c) => typeDirNames.has(c));
    if (hits.length >= 2) {
      return full;
    }
  }
  return defaultRoot;
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

export function ensureMemoryTree(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  for (const dir of MEMORY_DIR_NAMES) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
}

export function listMemoryFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(full);
      }
    }
  };
  walk(root);
  files.sort();
  return files;
}

export interface NoteContent {
  memory: Memory;
  body: string;
  raw: string;
  wikilinks: Wikilink[];
}

export function readMemoryNote(filePath: string): NoteContent {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(raw);
  if (!parsed.ok) {
    throw new Error(`${filePath}: ${parsed.error}`);
  }
  const memory = memoryFromNote(parsed.data, filePath, parsed.body);
  memory.related = [];
  memory.content = stripH1(parsed.body);
  return { memory, body: parsed.body, raw, wikilinks: extractWikilinks(parsed.body) };
}

/** Remove a leading "# Title" H1 line from a note body so content round-trips
 *  through markdownNote() (which always writes the H1). */
function stripH1(body: string): string {
  const trimmed = body.trimStart();
  const firstLineEnd = trimmed.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? trimmed : trimmed.slice(0, firstLineEnd);
  if (firstLine.startsWith("# ")) {
    return (firstLineEnd === -1 ? "" : trimmed.slice(firstLineEnd + 1)).trim();
  }
  return body.trim();
}

export function memoryDirFor(root: string, type: keyof typeof MEMORY_DIRS): string {
  return path.join(root, MEMORY_DIRS[type]);
}
