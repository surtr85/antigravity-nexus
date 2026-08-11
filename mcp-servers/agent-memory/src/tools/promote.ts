import { z } from "zod";
import type { ToolDef } from "./types.js";
import { okResult } from "./types.js";
import { promoteMemory } from "../memory/promote.js";

export const promoteTool: ToolDef = {
  name: "memory_promote",
  description:
    "Promote experiences/lessons/patterns into higher-level knowledge (experience → lesson → pattern → skill). Creates a new memory of the target type and preserves provenance via derived_from links to all source memories.",
  inputSchema: z.object({
    ids: z.array(z.string()).min(1).describe("Source memory ids"),
    targetType: z.enum(["lesson", "pattern", "skill"]).describe("Knowledge level to promote to"),
    title: z.string().min(1).max(200).describe("Title of the promoted knowledge"),
    content: z.string().min(1).max(50000).describe("Generalized content"),
    confidence: z.enum(["high", "medium", "low"]).optional().describe("Defaults to high if ≥2 sources are high"),
  }),
  handler: async (ctx, args) => {
    const result = promoteMemory(ctx, {
      ids: args.ids,
      targetType: args.targetType,
      title: args.title,
      content: args.content,
      confidence: args.confidence,
    });
    return okResult(result);
  },
};