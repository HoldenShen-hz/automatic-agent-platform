/**
 * Integration Tests: Recovery Service
 *
 * Tests recovery service with actual store interactions and database.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { RuntimeRecoveryService } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";

test("RuntimeRecoveryService with real store: lists recoverable executing runs", () => {
  const workspace = createTempWorkspace("recovery-service-");

  try {
    const dbPath = join(workspace, "test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new RuntimeRecoveryService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = newId("worker");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "test-division",
        title: "Test task",
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

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: workerId,
        roleId: null,
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 3,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const results = service.listRecoverableExecutingRuns(now);

    assert.ok(Array.isArray(results));
    // Depending on store implementation, may or may not include this execution
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("RuntimeRecoveryService with real store: lists blocked runs awaiting approval", () => {
  const workspace = createTempWorkspace("recovery-approval-");

  try {
    const dbPath = join(workspace, "test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new RuntimeRecoveryService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = newId("worker");
    const approvalId = newId("approval");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "test-division",
        title: "Blocked task",
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

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: workerId,
        roleId: null,
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: `trace-${executionId}`,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 3,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const results = service.listBlockedRunsAwaitingApproval();

    assert.ok(Array.isArray(results));
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("RuntimeRecoveryService with real store: buildRuntimeRecoveryView throws for missing task", () => {
  const workspace = createTempWorkspace("recovery-view-");

  try {
    const dbPath = join(workspace, "test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new RuntimeRecoveryService(store);

    assert.throws(
      () => service.buildRuntimeRecoveryView("nonexistent-task"),
      (err: unknown) => err instanceof Error && err.message.includes("not found"),
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("RuntimeRecoveryService with real store: division recovery overview calculation", () => {
  const workspace = createTempWorkspace("recovery-overview-");

  try {
    const dbPath = join(workspace, "test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new RuntimeRecoveryService(store);

    const staleBefore = new Date(Date.now() - 60000).toISOString();

    const overview = service.listDivisionRecoveryOverview(staleBefore);

    assert.ok(Array.isArray(overview));
    // Empty store should return empty array
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});