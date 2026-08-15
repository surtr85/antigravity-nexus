import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import https from "node:https";
import dns from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resolver } from "node:dns/promises";
import fs from "node:fs";

// Load .env silently from web-tools directory or process root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.resolve(__dirname, "../.env"),
  path.resolve(process.cwd(), ".env")
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (e) {
      // ignore
    }
  }
}

const PROXY_URL = process.env.PROXY_URL || "";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";

// Configure public DNS resolver (1.1.1.1 / 1.0.0.1 / 8.8.8.8) to bypass local DNS rewrites
const publicResolver = new Resolver();
publicResolver.setServers(["1.1.1.1", "1.0.0.1", "8.8.8.8"]);

function publicDnsLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  publicResolver.resolve4(hostname)
    .then((addresses) => {
      if (addresses && addresses.length > 0) {
        if (options.all) {
          callback(null, addresses.map((a) => ({ address: a, family: 4 })));
        } else {
          callback(null, addresses[0], 4);
        }
      } else {
        dns.lookup(hostname, options, callback);
      }
    })
    .catch(() => {
      dns.lookup(hostname, options, callback);
    });
}

function fetchWithPublicDns(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyData = options.body ? String(options.body) : null;
    const reqHeaders = { ...options.headers };
    if (bodyData && !reqHeaders["Content-Length"]) {
      reqHeaders["Content-Length"] = Buffer.byteLength(bodyData);
    }

    const req = https.request(
      url,
      {
        method: options.method || "GET",
        headers: reqHeaders,
        lookup: publicDnsLookup,
        timeout: options.timeout || 30000,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => { rawData += chunk; });
        res.on("end", () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => rawData,
            json: async () => JSON.parse(rawData),
          });
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function makeApiCall(targetUrl, headers, body) {
  if (PROXY_URL) {
    try {
      const res = await fetchWithPublicDns(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_url: targetUrl, headers, body }),
      });
      if (res.ok) {
        return res;
      }
    } catch (err) {
      console.error("Proxy request failed, falling back to direct:", err.message);
    }
  }

  // Fallback direct request using public DNS
  return await fetchWithPublicDns(targetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const server = new Server(
  { name: "web-tools-server", version: "1.2.0" },
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
    if (!TAVILY_API_KEY) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: TAVILY_API_KEY is not configured. Please add TAVILY_API_KEY to your .env file." }],
      };
    }

    try {
      const query = typeof safeArgs.query === "string" ? safeArgs.query.trim() : "";
      if (!query) {
        return { isError: true, content: [{ type: "text", text: "Error: No query provided." }] };
      }

      const searchDepth = safeArgs.search_depth === "advanced" ? "advanced" : "basic";
      const maxResults = typeof safeArgs.max_results === "number" ? Math.min(Math.max(safeArgs.max_results, 1), 20) : 5;
      const includeAnswer = safeArgs.include_answer !== false;

      const res = await makeApiCall(
        "https://api.tavily.com/search",
        { "Content-Type": "application/json" },
        {
          api_key: TAVILY_API_KEY,
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_answer: includeAnswer,
        }
      );

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
    if (!FIRECRAWL_API_KEY) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: FIRECRAWL_API_KEY is not configured. Please add FIRECRAWL_API_KEY to your .env file." }],
      };
    }

    try {
      const url = typeof safeArgs.url === "string" ? safeArgs.url.trim() : "";
      if (!url) {
        return { isError: true, content: [{ type: "text", text: "Error: No URL provided." }] };
      }

      const onlyMainContent = safeArgs.onlyMainContent !== false;

      const res = await makeApiCall(
        "https://api.firecrawl.dev/v1/scrape",
        {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        {
          url,
          formats: ["markdown"],
          onlyMainContent,
        }
      );

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
