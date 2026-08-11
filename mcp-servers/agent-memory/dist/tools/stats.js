import { z } from "zod";
import { okResult } from "./types.js";
import { computeStats } from "../memory/stats.js";
export const statsTool = {
    name: "memory_stats",
    description: "Return aggregate statistics about the memory store: counts by type/project/status, graph size, database size and index freshness.",
    inputSchema: z.object({}),
    handler: async (ctx) => {
        return okResult(computeStats(ctx));
    },
};
//# sourceMappingURL=stats.js.map