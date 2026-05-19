/**
 * E2E Test Harness
 *
 * Provides utilities for end-to-end tests that need to set up
 * full system components including database, services, and cleanup.
 */
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
export interface E2EHarness {
    /** Path to temporary workspace */
    workspace: string;
    /** Path to SQLite database */
    dbPath: string;
    /** Connected and migrated database */
    db: SqliteDatabase;
    /** Authoritative task store */
    store: AuthoritativeTaskStore;
    /** Cleanup function - call in test finally block */
    cleanup(): void;
}
/**
 * Creates a new E2E test harness.
 *
 * Usage:
 * ```typescript
 * test("full workflow", () => {
 *   const harness = createE2EHarness("aa-e2e-");
 *   try {
 *     // Set up initial state using harness.db or harness.store
 *     // Run E2E scenario
 *   } finally {
 *     harness.cleanup();
 *   }
 * });
 * ```
 */
export declare function createE2EHarness(prefix?: string): E2EHarness;
/**
 * Creates an E2E harness with a seeded task and execution.
 */
export declare function createSeededE2EHarness(prefix?: string, options?: {
    taskId?: string;
    executionId?: string;
}): E2EHarness;
