import { z } from "zod";
import type { ToolDef } from "./types.js";
import { okResult } from "./types.js";
import { timelineMemory } from "../memory/timeline.js";

export const timelineTool: ToolDef = {
  name: "memory_timeline",
  description:
    "Show how a concept evolved over time. Returns matching memories in chronological order (experience → lesson → pattern → skill).",
  inputSchema: z.object({
    query: z.string().optional().describe("Topic to trace; empty lists recent memories"),
    project: z.string().optional().describe("Restrict to a project"),
    limit: z.number().int().min(1).max(200).optional().default(50),
  }),
  handler: async (ctx, args) => {
    const entries = await timelineMemory(ctx, {
      query: args.query,
      project: args.project,
      limit: args.limit,
    });
    return okResult(entries);
  },
};