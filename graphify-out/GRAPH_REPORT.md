# Graph Report - antigravity-nexus  (2026-08-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 81 nodes · 101 edges · 11 communities (8 shown, 3 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e4a82e8b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9

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

## Communities (11 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (12): logged_in_async, auto_cross_sign_self(), custom_login(), find_agy_bin(), find_default_workspace(), patched_check_commitment(), patched_client_join(), patched_from_key_verification_start() (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (13): dotenv, dependencies, dotenv, @modelcontextprotocol/sdk, description, main, name, scripts (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (11): format_progress_bar(), get_usage_quota(), handle_command(), list_mcp(), list_skills(), Scans for available Antigravity skills across standard directories., Scans for available MCP servers and tools across standard directories., Queries agy /usage and formats quota visual progress bars. (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (9): custom_setup_callbacks(), download_matrix_media(), image_handler(), is_user_allowed(), Checks if a user is authorized to interact with Antigravity., Downloads & decrypts Matrix media from homeserver., Handles image and encrypted image upload events., Handles SAS Emoji and Cross-Signing Key Verification from authorized users. (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.28
Nodes (8): __dirname, envPaths, fetchWithPublicDns(), makeApiCall(), publicDnsLookup(), publicResolver, server, transport

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (7): main(), on_invite_callback(), Converts Markdown to clean Matrix-compatible HTML with tables support., Sends a rich HTML formatted message to Matrix., Automatically join room when invited by an authorized user., render_markdown_to_html(), send_formatted_message()

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): message_handler(), process_user_prompt(), Sends a reaction emoji to a specific event., Executes prompt via agy with full conversation and image attachment context., Handles regular text message events., send_reaction(), on_message_event

## Knowledge Gaps
- **16 isolated node(s):** `description`, `main`, `name`, `dev`, `start` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dotenv` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **What connects `description`, `main`, `name` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._