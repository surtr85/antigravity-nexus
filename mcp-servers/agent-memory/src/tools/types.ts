import { z } from "zod";
import type { MemoryContext } from "../memory/context.js";

export type ToolHandler = (ctx: MemoryContext, args: any) => Promise<unknown>;

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  handler: ToolHandler;
}

export function okResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}
