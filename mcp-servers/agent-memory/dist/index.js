import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { ensureAgentMemoryDir, ensureVaultExists, loadConfig, logger, } from "./config.js";
import { detectMemoryRoot, ensureMemoryTree } from "./vault/reader.js";
import { MemoryDatabase } from "./db/database.js";
import { countMemories, fullReindex } from "./db/indexer.js";
import { FtsSemanticSearch } from "./search/search.js";
import { createServer } from "./server.js";
export function initialize() {
    const config = loadConfig();
    logger.setLevel(config.logLevel);
    ensureVaultExists(config);
    ensureAgentMemoryDir(config);
    const root = detectMemoryRoot(config.vaultPath);
    ensureMemoryTree(root);
    const db = MemoryDatabase.open({ dbPath: config.dbPath });
    const indexed = countMemories(db);
    if (indexed === 0) {
        logger.info("index is empty; rebuilding from vault");
        const report = fullReindex(db, config.vaultPath);
        logger.info(`indexed ${report.indexed} memories` +
            (report.invalid.length > 0 ? `, ${report.invalid.length} invalid files skipped` : "") +
            (report.duplicateIds.length > 0 ? `, ${report.duplicateIds.length} duplicate ids skipped` : ""));
    }
    else {
        logger.info(`index ready: ${indexed} memories`);
    }
    const ctx = {
        vaultPath: config.vaultPath,
        root,
        db,
        search: new FtsSemanticSearch(db),
    };
    return { db, ctx };
}
async function main() {
    const { db, ctx } = initialize();
    const server = createServer(ctx);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    const shutdown = async () => {
        logger.info("shutting down");
        await server.close();
        db.close();
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
}
main().catch((err) => {
    logger.error(`fatal: ${err.stack ?? String(err)}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map