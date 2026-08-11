import { logger } from "../config.js";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema.js";
export function getSchemaVersion(db) {
    const row = db.prepare("PRAGMA user_version").get();
    return row.user_version;
}
export function runMigrations(db) {
    const current = getSchemaVersion(db);
    if (current === SCHEMA_VERSION)
        return;
    if (current > SCHEMA_VERSION) {
        throw new Error(`Database schema version ${current} is newer than supported version ${SCHEMA_VERSION}`);
    }
    db.exec("BEGIN");
    try {
        if (current < 1) {
            db.exec(SCHEMA_SQL);
            db.prepare("PRAGMA user_version = 1").run();
            logger.info("Applied schema v1");
        }
        db.exec("COMMIT");
    }
    catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }
}
//# sourceMappingURL=migrations.js.map