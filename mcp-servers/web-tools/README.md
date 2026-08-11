# web-tools-mcp

An MCP (Model Context Protocol) server providing web search via **Tavily** and web page scraping via **Firecrawl**.

## Tools

### 1. `tavily_search`
Search the web for real-time information, summaries, and relevant links.
- `query` (string, required): Search query
- `search_depth` ("basic" | "advanced", optional, default: "basic"): Search depth
- `max_results` (number, optional, default: 5): Maximum results
- `include_answer` (boolean, optional, default: true): Include AI summary

### 2. `firecrawl_scrape`
Extract clean markdown content from a specific web URL.
- `url` (string, required): The target webpage URL
- `onlyMainContent` (boolean, optional, default: true): Extract only the main body content

## Configuration & Environment Variables

| Variable | Description |
|---|---|
| `PROXY_URL` | Forwarding proxy endpoint (default: `https://search.surtr.ir`) |
| `TAVILY_API_KEY` | Tavily API Key |
| `FIRECRAWL_API_KEY` | Firecrawl API Key |

## Usage with MCP Clients

### OpenCode (`~/.config/opencode/opencode.jsonc`)
```jsonc
{
  "mcp": {
    "web-tools": {
      "type": "local",
      "command": ["node", "/home/amadeus/Workspace/mcp-servers/web-tools/src/index.mjs"],
      "enabled": true
    }
  }
}
```

### Claude Desktop / Codex / Generic stdio
```json
{
  "mcpServers": {
    "web-tools": {
      "command": "node",
      "args": ["/home/amadeus/Workspace/mcp-servers/web-tools/src/index.mjs"]
    }
  }
}
```
