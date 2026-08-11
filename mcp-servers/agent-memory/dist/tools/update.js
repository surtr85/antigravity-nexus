import { z } from "zod";
import { okResult } from "./types.js";
import { MEMORY_TYPES } from "../memory/types.js";
import { updateMemory } from "../memory/update.js";
export const updateTool = {
    name: "memory_update",
    description: "Update a memory. Only the fields explicitly provided are changed; all other metadata is preserved. The current vault file is re-read before writing to avoid clobbering concurrent changes.",
    inputSchema: z.object({
        id: z.string().describe("8-hex-char memory id"),
        title: z.string().optional(),
        content: z.string().optional(),
        type: z.enum(MEMORY_TYPES).optional(),
        status: z.enum(["active", "superseded", "deprecated", "unresolved", "verified", "uncertain"]).optional(),
        confidence: z.enum(["high", "medium", "low"]).optional(),
        tags: z.array(z.string()).optional(),
        project: z.string().optional().describe("Empty string clears the project"),
        related: z.array(z.string()).optional().describe("Replaces the related links"),
    }),
    handler: async (ctx, args) => {
        const result = updateMemory(ctx, {
            id: args.id,
            title: args.title,
            content: args.content,
            type: args.type,
            status: args.status,
            confidence: args.confidence,
            tags: args.tags,
            project: args.project,
            related: args.related,
        });
        return okResult(result);
    },
};
//# sourceMappingURL=update.js.map