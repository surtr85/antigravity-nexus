import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../config.js";
import { runMigrations } from "./migrations.js";

export interface DatabaseConfig {
  dbPath: string;
}

export type SqlValue = string | number | null | bigint | Uint8Array;

export class MemoryDatabase {
  private db: DatabaseSync;
  private readonly dbPath: string;

  private constructor(db: DatabaseSync, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  static open(config: DatabaseConfig): MemoryDatabase {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    const db = new DatabaseSync(config.dbPath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA foreign_keys = ON");
    runMigrations(db);
    return new MemoryDatabase(db, config.dbPath);
  }

  static openMemory(): MemoryDatabase {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA journal_mode = MEMORY");
    runMigrations(db);
    return new MemoryDatabase(db, ":memory:");
  }

  get raw(): DatabaseSync {
    return this.db;
  }

  get path(): string {
    return this.dbPath;
  }

  withTransaction<T>(fn: () => T): T {
    this.db.exec("BEGIN");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  close(): void {
    try {
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      // ignore checkpoint failures on close
    }
    this.db.close();
  }

  deleteDatabaseFile(): void {
    // Used only by tests / explicit tooling. Never called in normal operation.
    this.db.close();
    if (this.dbPath !== ":memory:") {
      for (const suffix of ["", "-wal", "-shm"]) {
        const f = this.dbPath + suffix;
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
    }
  }
}

export { logger };
