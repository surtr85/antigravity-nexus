import type { MemoryDatabase } from "../db/database.js";
import type { FtsSemanticSearch } from "../search/search.js";

export interface MemoryContext {
  vaultPath: string;
  root: string;
  db: MemoryDatabase;
  search: FtsSemanticSearch;
}
