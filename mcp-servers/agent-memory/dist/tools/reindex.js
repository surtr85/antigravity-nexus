import { z } from "zod";
import { okResult } from "./types.js";
import { fullReindex } from "../db/indexer.js";
export const reindexTool = {
    name: "memory_reindex",
    description: "Rescan the Obsidian vault and rebuild the SQLite index (FTS5 + metadata + wikilinks) from the Markdown files that are the source of truth. Safe to run anytime; reports invalid or malformed notes.",
    inputSchema: z.object({}),
    handler: async (ctx) => {
        const report = fullReindex(ctx.db, ctx.vaultPath);
        return okResult(report);
    },
};
//# sourceMappingURL=reindex.js.map