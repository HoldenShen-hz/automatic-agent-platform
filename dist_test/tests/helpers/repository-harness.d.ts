/**
 * Repository Test Harness
 *
 * Provides a unified way to set up and tear down SQLite database instances
 * for repository unit tests. This standardizes the DB setup pattern across
 * all 21 repository tests.
 */
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
export interface RepositoryHarness {
    /** Path to the temporary workspace directory */
    workspace: string;
    /** Path to the SQLite database file */
    dbPath: string;
    /** The connected database instance (already migrated) */
    db: SqliteDatabase;
    /** Cleanup function - call in test finally block */
    cleanup(): void;
}
/**
 * Creates a new test harness with a temporary SQLite database.
 *
 * Usage:
 * ```typescript
 * test("my repository test", () => {
 *   const harness = createRepositoryHarness("aa-my-repo-");
 *   try {
 *     const repo = new MyRepository(harness.db.connection);
 *     // ... test logic
 *   } finally {
 *     harness.cleanup();
 *   }
 * });
 * ```
 */
export declare function createRepositoryHarness(prefix?: string): RepositoryHarness;
/**
 * Creates a test harness with a pre-configured AuthoritativeTaskStore.
 * Use this when the repository under test requires the task store
 * (e.g., approval-repository, execution-repository).
 */
export declare function createRepositoryWithStoreHarness(prefix?: string): {
    store: any;
    /** Path to the temporary workspace directory */
    workspace: string;
    /** Path to the SQLite database file */
    dbPath: string;
    /** The connected database instance (already migrated) */
    db: SqliteDatabase;
    /** Cleanup function - call in test finally block */
    cleanup(): void;
};
