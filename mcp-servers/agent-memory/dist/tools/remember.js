import { z } from "zod";
import { okResult } from "./types.js";
import { MEMORY_TYPES } from "../memory/types.js";
import { rememberMemory } from "../memory/create.js";
export const rememberTool = {
    name: "memory_remember",
    description: "Store a durable memory. Performs deduplication: if an equivalent memory already exists it is updated instead of duplicated; if a likely contradiction is found the write is rejected with action=conflict. Returns created|updated|unchanged|conflict.",
    inputSchema: z.object({
        type: z.enum(MEMORY_TYPES).describe("Kind of memory"),
        title: z.string().min(1).max(200).describe("Short title"),
        content: z.string().min(1).max(50000).describe("Detailed content"),
        project: z.string().optional().describe("Project scope, e.g. 'homelab'"),
        confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
        tags: z.array(z.string()).optional(),
        source: z.string().optional().describe("Origin, e.g. 'session', 'agent-opencode'"),
        sourceSession: z.string().optional().describe("Session identifier"),
        related: z.array(z.string()).optional().describe("IDs of related memories to link"),
    }),
    handler: async (ctx, args) => {
        const result = await rememberMemory(ctx, {
            type: args.type,
            title: args.title,
            content: args.content,
            project: args.project,
            confidence: args.confidence,
            tags: args.tags,
            source: args.source,
            sourceSession: args.sourceSession,
            related: args.related,
        });
        return okResult(result);
    },
};
//# sourceMappingURL=remember.js.map