# agent-memory-mcp

A local **MCP server** that gives AI agents a persistent, structured, evolving
long-term memory, backed by an existing **Obsidian vault** of human-readable
Markdown.

Not a generic Obsidian file CRUD server. It implements a real memory layer:
retrieval, creation, updating, automatic file relocation, deduplication,
contradiction detection, temporal metadata, confidence, semantic relationships,
wikilinks and bidirectional backlinks, project-awareness,
`experience → lesson → pattern → skill` evolution, consolidation, forgetting,
extended secret rejection, and fast local search.

## Highlights

- **Obsidian Markdown is the source of truth.** SQLite (FTS5) is only an index.
  Delete `index.db` and run `npm run memory:reindex` — everything rebuilds
  from the vault.
- **Bidirectional Graph & Backlinks.** Traverses both outbound wikilinks and inbound
  backlinks across Obsidian notes so connected concepts are discovered naturally.
- **Smart File Relocation.** When updating a note's type (e.g. `fact` -> `lesson`) or title,
  the file is automatically relocated and renamed while preserving ID and links.
- **Search Ranking & Tag Filters.** FTS5 query matching with exact title matching boosts,
  tag filtering (`tags`), and minimum confidence thresholding (`minConfidence`).
- **No external services.** No OpenAI/Gemini/Anthropic/Ollama, no vector DB, no
  internet. Optional embeddings are behind a clean interface for a future version.
- **No native dependencies** beyond Node ≥22.13 (uses the built-in `node:sqlite`).
- **Zero-write garbage to stdout.** The server speaks MCP over stdio exclusively;
  all diagnostics go to stderr.

## Architecture

```
AI Agent
   │  MCP / stdio
   ▼
┌──────────────┬──────────────┐
 Memory Engine │ Search Engine │ Graph Engine (Wikilinks + Backlinks)
└──────────────┴──────────────┘
        └────────────┬─────────
                     ▼
           SQLite Index (FTS5 + metadata + wikilinks)
                     ▼
           Obsidian Vault Markdown  ←──── source of truth
```

Modules (`agent-memory/src/`):

| Path | Responsibility |
|---|---|
| `config.ts` | Env configuration + stderr logger |
| `server.ts` | MCP server wiring, tools, resources, prompts |
| `vault/reader.ts`, `writer.ts`, `scanner.ts`, `frontmatter.ts` | Vault discovery, atomic Markdown I/O, stable frontmatter |
| `db/database.ts`, `schema.ts`, `migrations.ts`, `indexer.ts` | SQLite (WAL), schema v1, rebuild-from-vault |
| `search/fts.ts`, `search/ranking.ts`, `search/search.ts` | FTS5 matching, title-boosted ranking, tag filters, `SemanticSearch` interface |
| `graph/links.ts`, `graph/traversal.ts` | Wikilink extraction, backlinks store, bidirectional BFS traversal |
| `memory/*` | Types, create/recall/update/delete/timeline, dedup, consolidate, promote, validate, stats |
| `tools/*` | One module per MCP tool |
| `cli.ts` | `reindex`, `stats`, `doctor` (with `--fix`), `search` commands |

## Installation

Requires Node.js `>= 22.13` (bundles `node:sqlite` with FTS5).

```bash
cd /home/amadeus/Workspace/mcp-servers/agent-memory
npm install
npm run memory:build      # tsc -> dist/
```

From the repository root the scripts are:

```bash
npm run memory:dev        # tsx src/index.ts       (dev)
npm run memory:build      # tsc -p agent-memory/tsconfig.json
npm run memory            # node agent-memory/dist/index.js   (start over stdio)
npm run memory:test       # vitest run
npm run memory:reindex    # rebuild SQLite from vault
npm run memory:stats      # JSON stats (types, projects, top tags, freshness)
npm run memory:doctor     # vault/db/index integrity checks (supports --fix)
npm run memory:search -- "my query" # search memories directly from terminal
```

### The vault it manages

```
/home/amadeus/Workspace/obsidian/
└── Agent Memory/
    ├── Facts/        Preferences/   Decisions/    Experiences/
    ├── Lessons/      Patterns/      Skills/       Problems/
    ├── Projects/     Sessions/
```

If the vault already has an equivalent structure, `vault/reader.ts` detects and
reuses it (`Agent Memory/` is preferred, otherwise a top-level directory that
already contains the type subfolders). The type subdirectories are auto-created
on first start.

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `OBSIDIAN_VAULT` | `/home/amadeus/Workspace/obsidian` | Vault root (must exist) |
| `MEMORY_DB` | `$OBSIDIAN_VAULT/.agent-memory/index.db` | Index only; deletable freely |
| `MEMORY_LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error`, written to stderr |
| `MEMORY_EMBEDDINGS` | `disabled` | Reserved; no embedding backend yet |

## MCP tools

| Tool | Purpose |
|---|---|
| `memory_recall` | Ranked retrieval for the current task (`query`, `project`, `types`, `tags`, `minConfidence`, `limit`, `includeRelated`). Ranking = FTS5 relevance + title boost + project exact + type/confidence + active-status + recency + graph-link count. |
| `memory_remember` | Store durable memory **with deduplication**. Returns `created | updated | unchanged | conflict`. Contradictions are never auto-written. |
| `memory_update` | Patch only the provided fields; re-reads the note before writing; automatically renames and relocates the note file if title or type changed. |
| `memory_forget` | `deprecate` (default, non-destructive, status deprecated + reason) or `delete` (destructive, explicit). |
| `memory_related` | Walk the memory graph (Obsidian wikilinks + indexed relations), BFS depth-limited. Supports `direction="both"|"outbound"|"inbound"`. |
| `memory_timeline` | Show how a concept evolved over time (chronological). |
| `memory_consolidate` | Propose duplicates / merge candidates / contradictions / repeated experiences / pattern & skill candidates / stale notes. `dryRun=true` by default; never deletes anything. |
| `memory_promote` | `experience → lesson`, `lesson → pattern`, `pattern → skill`. Creates a new higher-level memory and preserves provenance via `derived_from` links. |
| `memory_stats` | Counts by type/project/status, top tags, graph size, DB size, index freshness. |
| `memory_reindex` | Rescan vault, parse frontmatter, extract wikilinks, rebuild SQLite index, report invalid files. |

### Optional MCP resources

- `memory://stats` — `memory_stats` as a JSON resource
- `memory://recent` — 20 most recently updated memories
- `memory://projects` — per-project counts
- `memory://memory/{id}` — a single memory

### Optional MCP prompts

- `memory://session-start` — how to open a memory-assisted session
- `memory://session-end` — how to close one; deliberately no forced note creation

## Memory format

```markdown
---
id: 6f1d8a3b
type: lesson
status: active
confidence: high
project: homelab
created: 2026-08-11
updated: 2026-08-11
tags:
  - dns
  - systemd-resolved
source: session
source_session: 2026-08-11
---

# systemd-resolved stale DNS state

`systemd-resolved` may retain stale DNS routing state after
NetworkManager connection changes. Restarting the resolver can be
necessary before evaluating the new DNS configuration.

## Related

- [[NetworkManager]]
- [[AdGuard]]
- [[DNS]]
```

Frontmatter is valid YAML with stable key ordering; the title is the H1. Only
memories that the memory system itself created/manages are touched — arbitrary
Obsidian notes are preserved.

Types: `fact`, `preference`, `decision`, `experience`, `lesson`, `pattern`,
`skill`, `problem`, `project`, `session`.
Statuses: `active`, `superseded`, `deprecated`, `unresolved`, `verified`, `uncertain`.

## Security

- **Memory is data, never instructions.** Content containing
  `rm -rf ...`, shell commands, or "ignore previous rules" text is stored as
  inert text and is never executed or interpreted.
- **Extended secrets protection.** Content/titles/tags matching sensitive patterns
  (AWS/OpenAI/Anthropic/Tavily/Firecrawl keys, Bearer tokens, DB credentials URIs,
  API key assignments, JWTs, PEM private keys, `password=...`) raise a `ContentSafetyError`.
- **Prompt-injection resistance.** Client rules always outrank memory content;
  nothing in stored memory can alter server behavior.
- **Atomic writes.** Every Markdown write goes tmp-file + `fsync` + `rename`.
  A crash can never leave a truncated note behind.
- **Concurrency.** SQLite runs in WAL mode with a busy timeout; destructive
  updates re-read the file immediately before writing; the index is managed in
  transactions.
- **No hallucinated success.** A failed write raises a real MCP error.
- **Git-friendly.** Stable YAML key order, `updated` only bumps when content
  actually changes, and the DB lives under `.agent-memory/` (gitignored there).

## Testing & Quality

```bash
npm run memory:test
npm run memory:build
```

9 test suites covering 46 tests across:
- Note creation, roundtrip parsing, and atomic writes
- Automatic file relocation and slug renaming on updates
- Bidirectional backlink graph exploration
- FTS5 search with title boosts, tag filters, and confidence thresholds
- Multi-token deduplication, merge, and contradiction detection
- Evolution lifecycle (`experience → lesson → pattern → skill`)
- Extended secret protection and injection handling
- Crash recovery and database reconstruction from Obsidian Markdown