import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Get __dirname in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default vault path inside agent-memory directory: ./obsidian
export const DEFAULT_VAULT = process.env.OBSIDIAN_VAULT || path.resolve(__dirname, "../obsidian");

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Config {
  vaultPath: string;
  dbPath: string;
  logLevel: LogLevel;
  embeddings: string;
}

function envStr(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v.trim() !== "" ? v.trim() : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const vaultPath = path.resolve(envStr("OBSIDIAN_VAULT", DEFAULT_VAULT));
  const dbPath = path.resolve(
    envStr("MEMORY_DB", path.join(vaultPath, ".agent-memory", "index.db")),
  );
  const logLevelRaw = envStr("MEMORY_LOG_LEVEL", "info").toLowerCase();
  const logLevel: LogLevel = ["debug", "info", "warn", "error"].includes(logLevelRaw)
    ? (logLevelRaw as LogLevel)
    : "info";
  const embeddings = envStr("MEMORY_EMBEDDINGS", "disabled");
  return { vaultPath, dbPath, logLevel, embeddings };
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private log(level: LogLevel, message: string): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
    process.stderr.write(line);
  }

  debug(message: string): void {
    this.log("debug", message);
  }
  info(message: string): void {
    this.log("info", message);
  }
  warn(message: string): void {
    this.log("warn", message);
  }
  error(message: string): void {
    this.log("error", message);
  }
}

export const logger = new Logger();

export function ensureVaultExists(config: Config): void {
  if (!fs.existsSync(config.vaultPath)) {
    // If vault directory does not exist, initialize it automatically
    fs.mkdirSync(config.vaultPath, { recursive: true });
  }
  const stat = fs.statSync(config.vaultPath);
  if (!stat.isDirectory()) {
    throw new Error(`Vault path is not a directory: ${config.vaultPath}`);
  }
}

export function ensureAgentMemoryDir(config: Config): string {
  const dir = path.join(config.vaultPath, ".agent-memory");
  fs.mkdirSync(dir, { recursive: true });
  const gitignore = path.join(dir, ".gitignore");
  if (!fs.existsSync(gitignore)) {
    fs.writeFileSync(gitignore, "*.db\n*.db-shm\n*.db-wal\n");
  }
  return dir;
}
