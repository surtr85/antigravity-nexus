import { z } from "zod";
import { okResult } from "./types.js";
import { consolidateMemory } from "../memory/consolidate.js";
export const consolidateTool = {
    name: "memory_consolidate",
    description: "Analyze memories and propose a consolidation plan: duplicates, merge candidates, contradictions, repeated experiences, pattern/skill candidates and stale notes. Read-only by default (dryRun=true). It never deletes data; applying only creates non-destructive candidate memories and links.",
    inputSchema: z.object({
        query: z.string().optional().describe("Scope analysis to a topic"),
        project: z.string().optional().describe("Scope analysis to a project"),
        ids: z.array(z.string()).optional().describe("Analyze exactly these memories"),
        dryRun: z.boolean().optional().default(true).describe("false applies non-destructive actions"),
    }),
    handler: async (ctx, args) => {
        const plan = await consolidateMemory(ctx, {
            query: args.query,
            project: args.project,
            ids: args.ids,
            dryRun: args.dryRun,
        });
        return okResult(plan);
    },
};
//# sourceMappingURL=consolidate.js.map