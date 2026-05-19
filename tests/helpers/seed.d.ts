import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
export declare function seedTaskAndExecution(db: SqliteDatabase, store: AuthoritativeTaskStore, input: {
    taskId: string;
    executionId: string;
    traceId?: string;
}): void;
export declare function seedQueuedTasks(db: SqliteDatabase, store: AuthoritativeTaskStore, input: {
    count: number;
    prefix?: string;
}): void;
