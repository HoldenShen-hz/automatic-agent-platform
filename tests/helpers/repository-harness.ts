/**
 * Repository Test Harness
 *
 * Provides a unified way to set up and tear down SQLite database instances
 * for repository unit tests. This standardizes the DB setup pattern across
 * all 21 repository tests.
 */

import { join } from "node:path";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "./fs.js";

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
export function createRepositoryHarness(prefix: string = "aa-repo-"): RepositoryHarness {
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
      } finally {
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
export function createRepositoryWithStoreHarness(prefix: string = "aa-repo-store-") {
  const harness = createRepositoryHarness(prefix);
  const store = new AuthoritativeTaskStore(harness.db);

  return {
    ...harness,
    store,
  };
}
