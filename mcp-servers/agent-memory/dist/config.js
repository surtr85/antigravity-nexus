import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
// Get __dirname in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Default vault path inside agent-memory directory: ./obsidian
export const DEFAULT_VAULT = process.env.OBSIDIAN_VAULT || path.resolve(__dirname, "../obsidian");
function envStr(name, fallback) {
    const v = process.env[name];
    return v !== undefined && v.trim() !== "" ? v.trim() : fallback;
}
export function loadConfig(env = process.env) {
    const vaultPath = path.resolve(envStr("OBSIDIAN_VAULT", DEFAULT_VAULT));
    const dbPath = path.resolve(envStr("MEMORY_DB", path.join(vaultPath, ".agent-memory", "index.db")));
    const logLevelRaw = envStr("MEMORY_LOG_LEVEL", "info").toLowerCase();
    const logLevel = ["debug", "info", "warn", "error"].includes(logLevelRaw)
        ? logLevelRaw
        : "info";
    const embeddings = envStr("MEMORY_EMBEDDINGS", "disabled");
    return { vaultPath, dbPath, logLevel, embeddings };
}
const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
class Logger {
    level = "info";
    setLevel(level) {
        this.level = level;
    }
    log(level, message) {
        if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level])
            return;
        const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
        process.stderr.write(line);
    }
    debug(message) {
        this.log("debug", message);
    }
    info(message) {
        this.log("info", message);
    }
    warn(message) {
        this.log("warn", message);
    }
    error(message) {
        this.log("error", message);
    }
}
export const logger = new Logger();
export function ensureVaultExists(config) {
    if (!fs.existsSync(config.vaultPath)) {
        // If vault directory does not exist, initialize it automatically
        fs.mkdirSync(config.vaultPath, { recursive: true });
    }
    const stat = fs.statSync(config.vaultPath);
    if (!stat.isDirectory()) {
        throw new Error(`Vault path is not a directory: ${config.vaultPath}`);
    }
}
export function ensureAgentMemoryDir(config) {
    const dir = path.join(config.vaultPath, ".agent-memory");
    fs.mkdirSync(dir, { recursive: true });
    const gitignore = path.join(dir, ".gitignore");
    if (!fs.existsSync(gitignore)) {
        fs.writeFileSync(gitignore, "*.db\n*.db-shm\n*.db-wal\n");
    }
    return dir;
}
//# sourceMappingURL=config.js.map