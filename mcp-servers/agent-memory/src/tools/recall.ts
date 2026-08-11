import { z } from "zod";
import type { ToolDef } from "./types.js";
import { okResult } from "./types.js";
import { CONFIDENCE_LEVELS, MEMORY_TYPES } from "../memory/types.js";
import { recallMemory } from "../memory/recall.js";

export const recallTool: ToolDef = {
  name: "memory_recall",
  description:
    "Retrieve the most relevant memories for the current task. Ranked by textual relevance, title match, project, memory type, confidence, recency and graph links. Returns compact context for an LLM.",
  inputSchema: z.object({
    query: z.string().describe("Natural-language query describing the task or topic"),
    project: z.string().optional().describe("Only recall memories from this project"),
    types: z.array(z.enum(MEMORY_TYPES)).optional().describe("Restrict to these memory types"),
    tags: z.array(z.string()).optional().describe("Restrict to memories containing these tags"),
    minConfidence: z.enum(CONFIDENCE_LEVELS).optional().describe("Minimum confidence level ('high', 'medium', or 'low')"),
    limit: z.number().int().min(1).max(50).optional().default(5).describe("Max results (default 5)"),
    includeRelated: z.boolean().optional().default(false).describe("Include titles of linked memories"),
  }),
  handler: async (ctx, args) => {
    const entries = await recallMemory(ctx, args.query, {
      project: args.project,
      types: args.types,
      tags: args.tags,
      minConfidence: args.minConfidence,
      limit: args.limit,
      includeRelated: args.includeRelated,
    });
    return okResult(entries);
  },
};
