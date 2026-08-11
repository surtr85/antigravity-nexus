import path from "node:path";
import type { Memory } from "../memory/types.js";
import type { Wikilink } from "../graph/links.js";
import { detectMemoryRoot, listMemoryFiles, readMemoryNote } from "./reader.js";

export interface ScannedNote {
  filePath: string;
  memory: Memory;
  body: string;
  wikilinks: Wikilink[];
}

export interface ScanReport {
  root: string;
  notes: ScannedNote[];
  invalid: Array<{ filePath: string; error: string }>;
  duplicateIds: Array<{ id: string; paths: string[] }>;
}

export function scanVault(vaultPath: string): ScanReport {
  const root = detectMemoryRoot(vaultPath);
  const notes: ScannedNote[] = [];
  const invalid: Array<{ filePath: string; error: string }> = [];
  const idToPaths = new Map<string, string[]>();

  for (const filePath of listMemoryFiles(root)) {
    const rel = path.relative(vaultPath, filePath);
    try {
      const { memory, body, wikilinks } = readMemoryNote(filePath);
      const paths = idToPaths.get(memory.id) ?? [];
      paths.push(rel);
      idToPaths.set(memory.id, paths);
      notes.push({ filePath, memory, body, wikilinks });
    } catch (err) {
      invalid.push({ filePath: rel, error: (err as Error).message });
    }
  }

  const duplicateIds: Array<{ id: string; paths: string[] }> = [];
  for (const [id, paths] of idToPaths) {
    if (paths.length > 1) duplicateIds.push({ id, paths });
  }
  if (duplicateIds.length > 0) {
    notes.splice(
      0,
      notes.length,
      ...notes.filter((n) => {
        const paths = idToPaths.get(n.memory.id);
        return paths !== undefined && paths.length === 1;
      }),
    );
  }

  return { root, notes, invalid, duplicateIds };
}
