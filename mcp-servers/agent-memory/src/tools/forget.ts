import { z } from "zod";
import type { ToolDef } from "./types.js";
import { okResult } from "./types.js";
import { forgetMemory } from "../memory/delete.js";

export const forgetTool: ToolDef = {
  name: "memory_forget",
  description:
    "Delete or deprecate a memory. Defaults to deprecate (non-destructive): the note is kept with status=deprecated so history is preserved. Use mode=delete only for explicit destruction.",
  inputSchema: z.object({
    id: z.string().describe("8-hex-char memory id"),
    mode: z.enum(["delete", "deprecate"]).optional().default("deprecate"),
    reason: z.string().optional().describe("Why the memory is being deprecated"),
  }),
  handler: async (ctx, args) => {
    const result = forgetMemory(ctx, args.id, args.mode, args.reason);
    return okResult(result);
  },
};