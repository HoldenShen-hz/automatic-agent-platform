/**
 * Repository Test Harness
 *
 * Provides a unified way to set up and tear down SQLite database instances
 * for repository unit tests. This standardizes the DB setup pattern across
 * all 21 repository tests.
 */
import { join } from "node:path";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "./fs.js";
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
export function createRepositoryHarness(prefix = "aa-repo-") {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "repo-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    return {
        workspace,
        dbPath,
        db,
        cleanup() {
            try {
                db.close();
            }
            finally {
                cleanupPath(workspace);
            }
        },
    };
}
/**
 * Creates a test harness with a pre-configured AuthoritativeTaskStore.
 * Use this when the repository under test requires the task store
 * (e.g., approval-repository, execution-repository).
 */
export function createRepositoryWithStoreHarness(prefix = "aa-repo-store-") {
    const harness = createRepositoryHarness(prefix);
    // Lazy import to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AuthoritativeTaskStore } = require("../../src/platform/state-evidence/truth/authoritative-task-store.js");
    const store = new AuthoritativeTaskStore(harness.db);
    return {
        ...harness,
        store,
    };
}
//# sourceMappingURL=repository-harness.js.map