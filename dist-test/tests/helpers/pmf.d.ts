import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite-database.js";
export declare const PMF_EVALUATED_AT = "2026-04-08T12:00:00.000Z";
export declare function seedPmfValidationDataset(db: SqliteDatabase, store: AuthoritativeTaskStore): void;
