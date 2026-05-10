/**
 * @fileoverview HA Coordinator test initialization helpers
 *
 * Provides utilities for setting up the HA Coordinator singleton in tests.
 * Tests that use TransitionService or DurableEventBus must initialize
 * the HA coordinator before running.
 */

import { join } from "node:path";
import { HA_COORDINATOR_DDL, HaCoordinatorService } from "../../src/platform/five-plane-execution/ha/ha-coordinator-service-inner.js";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createTempWorkspace, cleanupPath } from "./fs.js";

/**
 * Default test node ID for HA coordinator tests
 */
export const TEST_NODE_ID = "test-node";
/**
 * Default test region for HA coordinator tests
 */
export const TEST_NODE_REGION = "us-east-1";
/**
 * Default TTL for test leadership in milliseconds
 */
export const TEST_LEADERSHIP_TTL_MS = 60000;

/**
 * Result of HA coordinator test initialization
 */
export interface HaCoordinatorTestContext {
  /** The SQLite database instance */
  db: SqliteDatabase;
  /** The initialized HA coordinator service */
  coordinator: HaCoordinatorService;
  /** Path to the temporary database */
  dbPath: string;
  /** Cleanup function to call after test */
  cleanup: () => void;
}

/**
 * Initializes the HA coordinator singleton for testing.
 *
 * This function must be called before tests that use TransitionService or
 * DurableEventBus, as these services require an active HA leader for certain
 * operations (e.g., leader authority checks in assertLeaderAuthoritative).
 *
 * @param options - Optional configuration
 * @param options.dbPath - Custom database path (creates temp workspace if not provided)
 * @param options.strictLeaderAuthority - Whether to enforce strict leader authority (default: false)
 * @param options.nodeId - Node ID for test (default: "test-node")
 * @param options.region - Node region (default: "us-east-1")
 * @param options.leadershipTtlMs - Leadership TTL in ms (default: 60000)
 *
 * @returns Test context with db, coordinator, and cleanup function
 *
 * @example
 * ```typescript
 * test("my test", async () => {
 *   const { db, coordinator, cleanup } = initHaCoordinatorForTests();
 *
 *   try {
 *     // Use coordinator, TransitionService, DurableEventBus, etc.
 *   } finally {
 *     cleanup();
 *   }
 * });
 * ```
 */
export function initHaCoordinatorForTests(options?: {
  dbPath?: string;
  strictLeaderAuthority?: boolean;
  nodeId?: string;
  region?: string;
  leadershipTtlMs?: number;
}): HaCoordinatorTestContext {
  const workspace = options?.dbPath ?? createTempWorkspace("aa-ha-coordinator-test-");
  const dbFilePath = join(workspace, "test-ha.db");

  const db = new SqliteDatabase(dbFilePath);
  db.migrate();

  // Initialize HA coordinator schema tables (coordinator_nodes, leadership_leases, etc.)
  // These are not part of the main SQLITE_MIGRATIONS since HA coordinator uses its own DDL
  db.connection.exec(HA_COORDINATOR_DDL);

  const coordinator = new HaCoordinatorService(db, { strictLeaderAuthority: options?.strictLeaderAuthority ?? false });

  coordinator.registerNode(options?.nodeId ?? TEST_NODE_ID, options?.region ?? TEST_NODE_REGION);
  coordinator.acquireLeadership({
    nodeId: options?.nodeId ?? TEST_NODE_ID,
    ttlMs: options?.leadershipTtlMs ?? TEST_LEADERSHIP_TTL_MS,
  });

  return {
    db,
    coordinator,
    dbPath: dbFilePath,
    cleanup: () => {
      coordinator.releaseLeadership(options?.nodeId ?? TEST_NODE_ID);
      db.close();
      cleanupPath(workspace);
    },
  };
}

/**
 * Resets the HA coordinator singleton.
 * Useful for cleanup between tests.
 * Note: The singleton lives in the src module, so this is a placeholder.
 * The real singleton is managed by the src module.
 */
export function resetHaCoordinatorInstance(): void {
  // The singleton is managed by the src module.
  // For test isolation, each test should use initHaCoordinatorForTests
  // which sets up its own coordinator with unique node IDs.
}