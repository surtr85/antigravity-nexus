import path from "node:path";
import { detectMemoryRoot, listMemoryFiles, readMemoryNote } from "./reader.js";
export function scanVault(vaultPath) {
    const root = detectMemoryRoot(vaultPath);
    const notes = [];
    const invalid = [];
    const idToPaths = new Map();
    for (const filePath of listMemoryFiles(root)) {
        const rel = path.relative(vaultPath, filePath);
        try {
            const { memory, body, wikilinks } = readMemoryNote(filePath);
            const paths = idToPaths.get(memory.id) ?? [];
            paths.push(rel);
            idToPaths.set(memory.id, paths);
            notes.push({ filePath, memory, body, wikilinks });
        }
        catch (err) {
            invalid.push({ filePath: rel, error: err.message });
        }
    }
    const duplicateIds = [];
    for (const [id, paths] of idToPaths) {
        if (paths.length > 1)
            duplicateIds.push({ id, paths });
    }
    if (duplicateIds.length > 0) {
        notes.splice(0, notes.length, ...notes.filter((n) => {
            const paths = idToPaths.get(n.memory.id);
            return paths !== undefined && paths.length === 1;
        }));
    }
    return { root, notes, invalid, duplicateIds };
}
//# sourceMappingURL=scanner.js.map