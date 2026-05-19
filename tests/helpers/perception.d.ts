import { PerceptionService } from "../../src/scale-ecosystem/marketplace/perception-service.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
export declare function seedPerceptionDataset(db: SqliteDatabase, store: AuthoritativeTaskStore): {
    service: PerceptionService;
    sourceId: string;
    briefId: string;
};
