# Graph Report - antigravity-nexus  (2026-08-16)

## Corpus Check
- 13 files · ~7,823 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 119 nodes · 136 edges · 13 communities (8 shown, 5 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e0a71caa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- matrix_antigravity_bridge.py
- package.json
- ⚡️ Antigravity Nexus
- image_handler
- index.mjs
- ⚡️ Antigravity Matrix Bridge
- process_user_prompt
- web-tools
- run_bridge.sh
- setup.sh
- rules/graphify.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)
1. `⚡️ Antigravity Nexus` - 13 edges
2. `process_user_prompt()` - 8 edges
3. `⚡️ Antigravity Matrix Bridge` - 7 edges
4. `is_user_allowed()` - 6 edges
5. `handle_command()` - 6 edges
6. `image_handler()` - 6 edges
7. `send_formatted_message()` - 5 edges
8. `get_usage_quota()` - 5 edges
9. `on_invite_callback()` - 5 edges
10. `message_handler()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `message_handler()` --calls--> `is_user_allowed()`  [EXTRACTED]
  matrix/matrix_antigravity_bridge.py → matrix/matrix_antigravity_bridge.py  _Bridges community 3 → community 6_
- `process_user_prompt()` --calls--> `run_agy()`  [EXTRACTED]
  matrix/matrix_antigravity_bridge.py → matrix/matrix_antigravity_bridge.py  _Bridges community 0 → community 6_

## Import Cycles
- None detected.

## Communities (13 total, 5 thin omitted)

### Community 0 - "matrix_antigravity_bridge.py"
Cohesion: 0.10
Nodes (23): logged_in_async, auto_cross_sign_self(), custom_login(), find_agy_bin(), find_default_workspace(), format_progress_bar(), get_usage_quota(), handle_command() (+15 more)

### Community 1 - "package.json"
Cohesion: 0.14
Nodes (13): dotenv, dependencies, dotenv, @modelcontextprotocol/sdk, description, main, name, scripts (+5 more)

### Community 2 - "⚡️ Antigravity Nexus"
Cohesion: 0.10
Nodes (21): 1. ⚡️ Matrix E2EE Chat Bridge (`matrix/`), 2.  Web Tools MCP Server (`mcp-servers/web-tools/`), ⚡️ Antigravity Nexus, Author & Maintainer, Autonomous AI Agent Workspace & Ecosystem, Core Features & Modules, Dedicated Documentation Index, Deploying the Cloudflare Worker Proxy (+13 more)

### Community 3 - "image_handler"
Cohesion: 0.18
Nodes (12): custom_setup_callbacks(), download_matrix_media(), image_handler(), is_user_allowed(), main(), on_invite_callback(), Checks if a user is authorized to interact with Antigravity., Automatically join room when invited by an authorized user. (+4 more)

### Community 4 - "index.mjs"
Cohesion: 0.28
Nodes (8): __dirname, envPaths, fetchWithPublicDns(), makeApiCall(), publicDnsLookup(), publicResolver, server, transport

### Community 5 - "⚡️ Antigravity Matrix Bridge"
Cohesion: 0.15
Nodes (11): 1. Configuration, 2. 1-Click Automated Installation, ⚡️ Antigravity Matrix Bridge, ⚙️ Background Daemon (systemd), 📂 Directory Layout, ✨ Key Features, Managing the Service, 🛠️ Manual Setup (+3 more)

### Community 6 - "process_user_prompt"
Cohesion: 0.18
Nodes (11): message_handler(), process_user_prompt(), Converts Markdown to clean Matrix-compatible HTML with tables support., Sends a rich HTML formatted message to Matrix., Sends a reaction emoji to a specific event., Executes prompt via agy with full conversation and image attachment context., Handles regular text message events., render_markdown_to_html() (+3 more)

## Knowledge Gaps
- **42 isolated node(s):** `node`, `Autonomous AI Agent Workspace & Ecosystem`, `Overview`, `️ System Architecture`, `Repository Structure` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dotenv` connect `package.json` to `matrix_antigravity_bridge.py`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `node`, `Autonomous AI Agent Workspace & Ecosystem`, `Overview` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `matrix_antigravity_bridge.py` be split into smaller, more focused modules?**
  _Cohesion score 0.10153846153846154 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `⚡️ Antigravity Nexus` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._