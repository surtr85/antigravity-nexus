import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const PROXY_URL = process.env.PROXY_URL || "https://search.surtr.ir";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "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";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "fc-deb0899c43da4021b891848cd6fdd372";

const server = new Server(
  { name: "web-tools-server", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "tavily_search",
      description: "Search the web for real-time information, summaries, and relevant links using Tavily Search API.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          search_depth: {
            type: "string",
            enum: ["basic", "advanced"],
            default: "basic",
            description: "Depth of search ('basic' is fast, 'advanced' is deeper)",
          },
          max_results: {
            type: "number",
            default: 5,
            description: "Maximum number of search results to return",
          },
          include_answer: {
            type: "boolean",
            default: true,
            description: "Whether to include an AI generated answer summary",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "firecrawl_scrape",
      description: "Extract clean, full markdown content and metadata from a specific web page URL using Firecrawl.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The target webpage URL to scrape" },
          onlyMainContent: {
            type: "boolean",
            default: true,
            description: "Extract only main body content, removing headers/navs/footers",
          },
        },
        required: ["url"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = args || {};

  // 1. Tavily Search
  if (name === "tavily_search") {
    try {
      const query = typeof safeArgs.query === "string" ? safeArgs.query.trim() : "";
      if (!query) {
        return { isError: true, content: [{ type: "text", text: "Error: No query provided." }] };
      }

      const searchDepth = safeArgs.search_depth === "advanced" ? "advanced" : "basic";
      const maxResults = typeof safeArgs.max_results === "number" ? Math.min(Math.max(safeArgs.max_results, 1), 20) : 5;
      const includeAnswer = safeArgs.include_answer !== false;

      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          target_url: "https://api.tavily.com/search",
          headers: { "Content-Type": "application/json" },
          body: {
            api_key: TAVILY_API_KEY,
            query,
            search_depth: searchDepth,
            max_results: maxResults,
            include_answer: includeAnswer,
          },
        }),
      });

      if (!res.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: `Tavily Search Error HTTP ${res.status}: ${await res.text()}` }],
        };
      }

      const data = await res.json();
      const answer = data?.answer ? `### Quick Answer\n${data.answer}\n\n` : "";
      const results = Array.isArray(data?.results) ? data.results : [];

      return {
        content: [
          {
            type: "text",
            text: answer + JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Tavily Search Failed: ${err.message}` }] };
    }
  }

  // 2. Firecrawl Scrape
  if (name === "firecrawl_scrape") {
    try {
      const url = typeof safeArgs.url === "string" ? safeArgs.url.trim() : "";
      if (!url) {
        return { isError: true, content: [{ type: "text", text: "Error: No URL provided." }] };
      }

      const onlyMainContent = safeArgs.onlyMainContent !== false;

      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          target_url: "https://api.firecrawl.dev/v1/scrape",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: {
            url,
            formats: ["markdown"],
            onlyMainContent,
          },
        }),
      });

      if (!res.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: `Firecrawl Scrape Error HTTP ${res.status}: ${await res.text()}` }],
        };
      }

      const data = await res.json();
      const markdown =
        data?.data?.markdown ||
        data?.markdown ||
        "No content could be extracted from this URL.";

      return {
        content: [{ type: "text", text: String(markdown) }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Firecrawl Scrape Failed: ${err.message}` }] };
    }
  }

  return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
