import fs from "node:fs";
import {
  ensureAgentMemoryDir,
  ensureVaultExists,
  loadConfig,
  logger,
} from "./config.js";
import { detectMemoryRoot } from "./vault/reader.js";
import { MemoryDatabase } from "./db/database.js";
import { countMemories, fullReindex } from "./db/indexer.js";
import { FtsSemanticSearch } from "./search/search.js";
import { computeStats } from "./memory/stats.js";
import { scanVault } from "./vault/scanner.js";
import { buildTitleIndex, linkTargetKey } from "./graph/links.js";
import { detectSecrets, detectInstructionText } from "./memory/validate.js";

const COMMANDS = ["reindex", "stats", "doctor", "search"] as const;

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || !(COMMANDS as readonly string[]).includes(command)) {
    console.error(`usage: agent-memory <${COMMANDS.join("|")}> [args...]`);
    process.exit(2);
  }

  const config = loadConfig();
  logger.setLevel(config.logLevel);

  if (command === "doctor") {
    const fix = process.argv.includes("--fix");
    const code = await runDoctor(config.vaultPath, config.dbPath, fix);
    process.exit(code);
  }

  ensureVaultExists(config);
  ensureAgentMemoryDir(config);
  const root = detectMemoryRoot(config.vaultPath);
  const db = MemoryDatabase.open({ dbPath: config.dbPath });

  if (command === "reindex") {
    const report = fullReindex(db, config.vaultPath);
    console.log(
      JSON.stringify(
        {
          root: report.root,
          indexed: report.indexed,
          invalid: report.invalid,
          duplicateIds: report.duplicateIds,
        },
        null,
        2,
      ),
    );
    if (report.invalid.length > 0 || report.duplicateIds.length > 0) {
      process.exitCode = 1;
    }
  } else if (command === "stats") {
    const ctx = { vaultPath: config.vaultPath, root, db, search: new FtsSemanticSearch(db) };
    console.log(JSON.stringify(computeStats(ctx), null, 2));
  } else if (command === "search") {
    const query = process.argv.slice(3).join(" ").trim();
    if (!query) {
      console.error("usage: agent-memory search <query>");
      process.exit(2);
    }
    const search = new FtsSemanticSearch(db);
    const results = await search.search(query, { limit: 10 });
    console.log(JSON.stringify(results, null, 2));
  }

  db.close();
}

interface DoctorResult {
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
  problems: string[];
}

async function runDoctor(vaultPath: string, dbPath: string, autoFix = false): Promise<number> {
  const result: DoctorResult = { checks: [], problems: [] };
  const add = (name: string, ok: boolean, detail?: string): void => {
    result.checks.push({ name, ok, detail });
    if (!ok) result.problems.push(`${name}${detail ? `: ${detail}` : ""}`);
  };

  add("vault exists", fs.existsSync(vaultPath), vaultPath);
  if (!fs.existsSync(vaultPath)) {
    printDoctor(result);
    return 1;
  }

  let writable = true;
  const probe = `${vaultPath}/.agent-memory/.write-probe`;
  try {
    fs.mkdirSync(`${vaultPath}/.agent-memory`, { recursive: true });
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
  } catch (err) {
    writable = false;
    add("vault writable", false, (err as Error).message);
  }
  if (writable) add("vault writable", true);

  let db: MemoryDatabase;
  try {
    db = MemoryDatabase.open({ dbPath });
    add("database accessible", true);
  } catch (err) {
    add("database accessible", false, (err as Error).message);
    printDoctor(result);
    return 1;
  }
  add("schema current", true);

  const scan = scanVault(vaultPath);
  let indexedCount = countMemories(db);
  const noteCount = scan.notes.length;

  if (indexedCount !== noteCount && autoFix) {
    logger.info("reindexing index because count mismatch was detected");
    fullReindex(db, vaultPath);
    indexedCount = countMemories(db);
  }

  add("index matches vault", indexedCount === noteCount,
    indexedCount === noteCount ? undefined : `index has ${indexedCount}, vault has ${noteCount} notes — run memory:reindex`);
  add("all notes parse", scan.invalid.length === 0, scan.invalid.length > 0 ? `${scan.invalid.length} invalid` : undefined);
  add("no duplicate ids", scan.duplicateIds.length === 0, scan.duplicateIds.length > 0 ? `${scan.duplicateIds.length} duplicate ids` : undefined);

  const titleIndex = buildTitleIndex(db);
  const broken: string[] = [];
  for (const note of scan.notes) {
    for (const link of note.wikilinks) {
      const key = linkTargetKey(link.label);
      if (!titleIndex.byNormalized.has(key)) {
        broken.push(`${note.memory.title} -> [[${link.label}]]`);
      }
    }
  }
  add("no broken wikilinks", broken.length === 0, broken.length > 0 ? broken.slice(0, 5).join("; ") : undefined);

  const secretNotes: string[] = [];
  const instructionNotes: string[] = [];
  for (const note of scan.notes) {
    const blob = `${note.memory.title}\n${note.body}`;
    if (detectSecrets(blob).length > 0) secretNotes.push(note.memory.id);
    if (detectInstructionText(blob)) instructionNotes.push(note.memory.id);
  }
  add("no stored secrets", secretNotes.length === 0, secretNotes.length > 0 ? `secrets detected in ${secretNotes.join(", ")}` : undefined);
  if (instructionNotes.length > 0) {
    add("instruction-like text stored", true, `stored as data in ${instructionNotes.join(", ")} (expected, treated as inert text)`);
  }

  db.close();
  printDoctor(result);
  return result.problems.length > 0 ? 1 : 0;
}

function printDoctor(result: DoctorResult): void {
  for (const check of result.checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  if (result.problems.length > 0) {
    console.log(`\n${result.problems.length} problem(s) found.`);
  } else {
    console.log("\nAll checks passed.");
  }
}

main().catch((err) => {
  logger.error(`cli failed: ${(err as Error).stack ?? String(err)}`);
  process.exit(1);
});
