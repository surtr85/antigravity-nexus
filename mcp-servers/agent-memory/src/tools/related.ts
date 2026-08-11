import { z } from "zod";
import type { ToolDef } from "./types.js";
import { okResult } from "./types.js";
import { traverseGraph } from "../graph/traversal.js";

export const relatedTool: ToolDef = {
  name: "memory_related",
  description:
    "Explore the memory graph around a memory, following Obsidian wikilinks and indexed relationships (outbound links and inbound backlinks). Breadth-first traversal with a depth limit; it never traverses the whole vault.",
  inputSchema: z.object({
    id: z.string().describe("8-hex-char memory id"),
    depth: z.number().int().min(1).max(6).optional().default(2).describe("Traversal depth (1-6, default 2)"),
    limit: z.number().int().min(1).max(100).optional().default(30).describe("Max nodes to return (default 30)"),
    direction: z.enum(["both", "outbound", "inbound"]).optional().default("both").describe("Traversal direction: 'both' (includes backlinks), 'outbound' (links from note), or 'inbound' (notes linking here)"),
  }),
  handler: async (ctx, args) => {
    const graph = traverseGraph(ctx.db, args.id, args.depth, args.limit, args.direction);
    return okResult(graph);
  },
};