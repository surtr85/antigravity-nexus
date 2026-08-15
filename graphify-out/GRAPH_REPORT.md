# Graph Report - antigravity-nexus  (2026-08-16)

## Corpus Check
- 13 files · ~7,823 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 85 nodes · 103 edges · 13 communities (8 shown, 5 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `968d27df`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- matrix_antigravity_bridge.py
- package.json
- handle_command
- image_handler
- index.mjs
- on_invite_callback
- process_user_prompt
- web-tools
- run_bridge.sh
- setup.sh
- rules/graphify.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)
1. `process_user_prompt()` - 8 edges
2. `handle_command()` - 6 edges
3. `image_handler()` - 6 edges
4. `is_user_allowed()` - 6 edges
5. `get_usage_quota()` - 5 edges
6. `on_invite_callback()` - 5 edges
7. `send_formatted_message()` - 5 edges
8. `message_handler()` - 5 edges
9. `run_agy()` - 4 edges
10. `to_device_callback()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `main()` --indirect_call--> `image_handler()`  [INFERRED]
  matrix/matrix_antigravity_bridge.py → matrix/matrix_antigravity_bridge.py  _Bridges community 3 → community 5_
- `process_user_prompt()` --calls--> `handle_command()`  [EXTRACTED]
  matrix/matrix_antigravity_bridge.py → matrix/matrix_antigravity_bridge.py  _Bridges community 2 → community 6_
- `image_handler()` --calls--> `process_user_prompt()`  [EXTRACTED]
  matrix/matrix_antigravity_bridge.py → matrix/matrix_antigravity_bridge.py  _Bridges community 3 → community 6_
- `process_user_prompt()` --calls--> `send_formatted_message()`  [EXTRACTED]
  matrix/matrix_antigravity_bridge.py → matrix/matrix_antigravity_bridge.py  _Bridges community 5 → community 6_

## Import Cycles
- None detected.

## Communities (13 total, 5 thin omitted)

### Community 0 - "matrix_antigravity_bridge.py"
Cohesion: 0.16
Nodes (12): logged_in_async, auto_cross_sign_self(), custom_login(), find_agy_bin(), find_default_workspace(), patched_check_commitment(), patched_client_join(), patched_from_key_verification_start() (+4 more)

### Community 1 - "package.json"
Cohesion: 0.14
Nodes (13): dotenv, dependencies, dotenv, @modelcontextprotocol/sdk, description, main, name, scripts (+5 more)

### Community 2 - "handle_command"
Cohesion: 0.18
Nodes (11): format_progress_bar(), get_usage_quota(), handle_command(), list_mcp(), list_skills(), Scans for available Antigravity skills across standard directories., Scans for available MCP servers and tools across standard directories., Queries agy /usage and formats quota visual progress bars. (+3 more)

### Community 3 - "image_handler"
Cohesion: 0.22
Nodes (9): custom_setup_callbacks(), download_matrix_media(), image_handler(), is_user_allowed(), Checks if a user is authorized to interact with Antigravity., Downloads & decrypts Matrix media from homeserver., Handles image and encrypted image upload events., Handles SAS Emoji and Cross-Signing Key Verification from authorized users. (+1 more)

### Community 4 - "index.mjs"
Cohesion: 0.28
Nodes (8): __dirname, envPaths, fetchWithPublicDns(), makeApiCall(), publicDnsLookup(), publicResolver, server, transport

### Community 5 - "on_invite_callback"
Cohesion: 0.29
Nodes (7): main(), on_invite_callback(), Converts Markdown to clean Matrix-compatible HTML with tables support., Sends a rich HTML formatted message to Matrix., Automatically join room when invited by an authorized user., render_markdown_to_html(), send_formatted_message()

### Community 6 - "process_user_prompt"
Cohesion: 0.29
Nodes (7): message_handler(), process_user_prompt(), Sends a reaction emoji to a specific event., Executes prompt via agy with full conversation and image attachment context., Handles regular text message events., send_reaction(), on_message_event

## Knowledge Gaps
- **18 isolated node(s):** `graphify`, `Workflow: graphify`, `description`, `main`, `name` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dotenv` connect `package.json` to `matrix_antigravity_bridge.py`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **What connects `graphify`, `Workflow: graphify`, `description` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._