# Web Tools MCP Server (`web-tools`)

An MCP (Model Context Protocol) server providing web search via **Tavily** and clean webpage scraping via **Firecrawl**, with optional Cloudflare Worker proxy support.

---

## 🛠️ Tools

### 1. `tavily_search`
Search the web for real-time information, summaries, and relevant links.
- `query` (string, required): The search query.
- `search_depth` (`"basic"` | `"advanced"`, optional, default: `"basic"`): Search depth.
- `max_results` (number, optional, default: `5`): Maximum number of search results (1-20).
- `include_answer` (boolean, optional, default: `true`): Include AI-generated summary answer.

### 2. `firecrawl_scrape`
Extract clean, full markdown content from any web page URL.
- `url` (string, required): The target webpage URL to scrape.
- `onlyMainContent` (boolean, optional, default: `true`): Extract only the main body content, removing navigation, headers, and footers.

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in this directory or configure environment variables in your MCP client:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|:---:|---|
| `TAVILY_API_KEY` | Yes | Tavily API Key (from [tavily.com](https://tavily.com)) |
| `FIRECRAWL_API_KEY` | Yes | Firecrawl API Key (from [firecrawl.dev](https://firecrawl.dev)) |
| `PROXY_URL` | Optional | Custom Cloudflare Worker proxy URL for restricted networks |

---

## 🌐 Cloudflare Worker Proxy (`worker.js`)

If you are running in a restricted network or region where Tavily or Firecrawl are inaccessible, you can deploy the included [`worker.js`](worker.js) to Cloudflare Workers for free:

```javascript
// worker.js
export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Proxy Active', { status: 200 });
    }
    try {
      const { target_url, headers, body } = await request.json();
      if (!target_url) {
        return new Response(JSON.stringify({ error: 'target_url is required' }), { status: 400 });
      }
      const response = await fetch(target_url, {
        method: 'POST',
        headers: headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const responseText = await response.text();
      return new Response(responseText, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
};
```

Set `PROXY_URL=https://your-worker-name.your-subdomain.workers.dev` in your `.env` file to route all search and scrape requests through your Cloudflare Worker.

---

## 🚀 Usage with MCP Clients

### Antigravity (`.agents/mcp_config.json`)
```json
{
  "mcpServers": {
    "web-tools": {
      "command": "node",
      "args": ["mcp-servers/web-tools/src/index.mjs"]
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "web-tools": {
      "command": "node",
      "args": ["/absolute/path/to/workspace/mcp-servers/web-tools/src/index.mjs"],
      "env": {
        "TAVILY_API_KEY": "your_tavily_key",
        "FIRECRAWL_API_KEY": "your_firecrawl_key"
      }
    }
  }
}
```
