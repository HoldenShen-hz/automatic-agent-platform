/**
 * E2E Test Harness
 *
 * Provides utilities for end-to-end tests that need to set up
 * full system components including database, services, and cleanup.
 */

import { join } from "node:path";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "./fs.js";

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
export function createE2EHarness(prefix: string = "aa-e2e-"): E2EHarness {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  return {
    workspace,
    dbPath,
    db,
    store,
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
 * Creates an E2E harness with a seeded task and execution.
 */
export function createSeededE2EHarness(
  prefix: string = "aa-e2e-seeded-",
  options: { taskId?: string; executionId?: string } = {},
): E2EHarness {
  const harness = createE2EHarness(prefix);
  const taskId = options.taskId ?? "task-e2e-001";
  const executionId = options.executionId ?? "exec-e2e-001";
  const now = new Date().toISOString();

  harness.db.transaction(() => {
    harness.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId: null,
      title: "E2E test task",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    harness.store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      harnessRunId: null,
      agentId: "agent-e2e",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: `trace-${executionId}`,
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1,
      budgetReservationId: null,
      budgetLedgerId: null,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  return harness;
}
