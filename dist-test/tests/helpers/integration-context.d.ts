/**
 * Integration Test Context
 *
 * Provides a unified context for integration tests with consistent
 * DB setup, store initialization, and cleanup patterns.
 */
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
export interface IntegrationContext {
    /** Path to temporary workspace */
    workspace: string;
    /** Path to SQLite database */
    dbPath: string;
    /** Connected and migrated database instance */
    db: SqliteDatabase;
    /** Authoritative task store */
    store: AuthoritativeTaskStore;
    /** Cleanup function - call in test finally block */
    cleanup(): void;
}
/**
 * Creates a new integration test context with a temporary SQLite database.
 *
 * Usage:
 * ```typescript
 * test("my integration test", () => {
 *   const ctx = createIntegrationContext("aa-my-test-");
 *   try {
 *     // Use ctx.db, ctx.store, etc.
 *   } finally {
 *     ctx.cleanup();
 *   }
 * });
 * ```
 */
export declare function createIntegrationContext(prefix?: string): IntegrationContext;
/**
 * Creates an integration context with pre-seeded task and execution.
 * Use this when the test requires a valid task/execution for FK constraints.
 */
export declare function createSeededIntegrationContext(prefix?: string, options?: {
    taskId?: string;
    executionId?: string;
}): IntegrationContext;
