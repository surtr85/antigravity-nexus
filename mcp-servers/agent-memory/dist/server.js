import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { TOOLS } from "./tools/index.js";
import { computeStats } from "./memory/stats.js";
import { memoryById } from "./db/indexer.js";
export function createServer(ctx) {
    const server = new McpServer({ name: "agent-memory-mcp", version: "0.1.0" }, {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
    });
    for (const tool of TOOLS) {
        server.registerTool(tool.name, {
            description: tool.description,
            inputSchema: tool.inputSchema,
        }, (async (args) => {
            const result = await tool.handler(ctx, (args ?? {}));
            return result;
        }));
    }
    registerResources(server, ctx);
    registerPrompts(server);
    return server;
}
function registerResources(server, ctx) {
    server.registerResource("stats", "memory://stats", { mimeType: "application/json", title: "Memory statistics" }, () => ({
        contents: [{ uri: "memory://stats", text: JSON.stringify(computeStats(ctx), null, 2) }],
    }));
    server.registerResource("recent", "memory://recent", { mimeType: "application/json", title: "Most recently updated memories" }, () => {
        const rows = ctx.db.raw
            .prepare("SELECT id, title, type, status, updated_at FROM memories ORDER BY updated_at DESC LIMIT 20")
            .all();
        return {
            contents: [{ uri: "memory://recent", text: JSON.stringify(rows, null, 2) }],
        };
    });
    server.registerResource("projects", "memory://projects", { mimeType: "application/json", title: "Memory count per project" }, () => {
        const rows = ctx.db.raw
            .prepare("SELECT project, count(*) AS c FROM memories WHERE project IS NOT NULL GROUP BY project ORDER BY c DESC")
            .all();
        return {
            contents: [{ uri: "memory://projects", text: JSON.stringify(rows, null, 2) }],
        };
    });
    server.registerResource("memory", "memory://memory/{id}", { mimeType: "application/json", title: "A single memory by id" }, (uri) => {
        const id = new URL(uri.href).pathname.split("/").pop();
        const memory = id ? memoryById(ctx.db, id) : null;
        if (!memory) {
            throw new Error(`Memory not found: ${id}`);
        }
        return { contents: [{ uri: uri.href, text: JSON.stringify(memory, null, 2) }] };
    });
}
function registerPrompts(server) {
    server.registerPrompt("session-start", {
        title: "Session start",
        description: "Instructions for beginning a memory-assisted session",
        argsSchema: z.object({
            task: z.string().optional(),
            project: z.string().optional(),
        }),
    }, (args) => ({
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `You have a persistent long-term memory system (agent-memory) backed by an Obsidian vault. ` +
                        `Use the memory_* tools to recall, store and maintain knowledge.\n\n` +
                        `At session start:\n` +
                        `1. Call memory_recall with your current task${args.task ? `: "${args.task}"` : ""} ` +
                        `${args.project ? `scoped to project "${args.project}"` : ""}.\n` +
                        `2. If relevant results appear, call memory_related on the top one or two to gather context.\n` +
                        `3. Remember durable discoveries with memory_remember (type should fit fact/decision/experience/lesson/problem).\n` +
                        `4. Keep memories few and high-quality; never store credentials or secrets.`,
                },
            },
        ],
    }));
    server.registerPrompt("session-end", {
        title: "Session end",
        description: "Instructions for closing a memory-assisted session",
        argsSchema: z.object({
            task: z.string().optional(),
            project: z.string().optional(),
        }),
    }, (args) => ({
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Session is ending. Review what happened and decide what is worth remembering:\n` +
                        `1. Use memory_remember for durable session-level discoveries (decisions made, lessons learned, unresolved problems).\n` +
                        `2. If the session produced nothing durable, do nothing — an empty session must not create junk notes.\n` +
                        `3. For substantial sessions, run memory_consolidate (dryRun=true) and follow up on duplicates or contradictions.\n` +
                        `4. Only promote to pattern/skill via memory_promote when a procedure repeated and proved stable.` +
                        `${args.project ? `\nProject context: ${args.project}` : ""}`,
                },
            },
        ],
    }));
}
//# sourceMappingURL=server.js.map