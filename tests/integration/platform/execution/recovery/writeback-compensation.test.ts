/**
 * Recovery Integration Test: Writeback Compensation
 *
 * Verifies that execution writebacks work correctly with leases.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("recovery: failed writeback can be retried successfully", () => {
  const workspace = createTempWorkspace("recovery-writeback-");

  try {
    const dbPath = join(workspace, "writeback-retry.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const workerId = newId("worker");
    const executionId = newId("exec");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Writeback retry test",
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
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 0,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Insert active lease for the execution
      store.insertExecutionLease({
        id: newId("lease"),
        executionId,
        workerId,
        attempt: 1,
        fencingToken: 1,
        queueName: null,
        status: "active",
        leasedAt: now,
        expiresAt: new Date(Date.now() + 30000).toISOString(),
        lastHeartbeatAt: now,
        releasedAt: null,
        reasonCode: null,
      });
    });

    // Verify execution is in 'executing' status
    const executingExecution = db.connection
      .prepare("SELECT status FROM executions WHERE id = ?")
      .get(executionId) as { status: string } | undefined;

    assert.ok(executingExecution, "Execution should exist");
    assert.strictEqual(executingExecution!.status, "executing", "Execution should be in executing status");

    // Verify lease is active
    const activeLease = db.connection
      .prepare("SELECT status FROM execution_leases WHERE execution_id = ? AND status = 'active'")
      .get(executionId) as { status: string } | undefined;

    assert.ok(activeLease, "Lease should be active initially");

    // Simulate successful writeback: update execution to completed and release lease
    db.transaction(() => {
      // Update execution to completed
      db.connection
        .prepare("UPDATE executions SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?")
        .run("succeeded", nowIso(), nowIso(), executionId);

      // Release the lease
      store.closeExecutionLease({
        leaseId: activeLease!.status as unknown as string,
        status: "released",
        releasedAt: nowIso(),
        reasonCode: null,
      });
    });

    // Verify execution is now completed
    const completedExecution = db.connection
      .prepare("SELECT status, finished_at FROM executions WHERE id = ?")
      .get(executionId) as { status: string; finished_at: string } | undefined;

    assert.ok(completedExecution, "Execution should exist after writeback");
    assert.strictEqual(completedExecution!.status, "succeeded", "Execution should be succeeded after writeback");
    assert.ok(completedExecution!.finished_at, "Finished at should be set");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: expired lease prevents writeback", () => {
  const workspace = createTempWorkspace("recovery-idempotent-");

  try {
    const dbPath = join(workspace, "idempotent-writeback.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const workerId = newId("worker");
    const executionId = newId("exec");
    const now = nowIso();

    // Create task and execution
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Idempotent writeback test",
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
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 0,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Insert an already-expired lease
      const expiredTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      store.insertExecutionLease({
        id: newId("lease"),
        executionId,
        workerId,
        attempt: 1,
        fencingToken: 1,
        queueName: null,
        status: "active",
        leasedAt: now,
        expiresAt: expiredTime,
        lastHeartbeatAt: now,
        releasedAt: null,
        reasonCode: null,
      });
    });

    // Verify the lease is expired
    const expiredLease = db.connection
      .prepare("SELECT expires_at FROM execution_leases WHERE execution_id = ? AND status = 'active'")
      .get(executionId) as { expires_at: string } | undefined;

    assert.ok(expiredLease, "Lease should exist");
    assert.ok(expiredLease!.expires_at < nowIso(), "Lease should be expired");

    // Execution should still be 'executing' since we haven't updated it
    const executingExecution = db.connection
      .prepare("SELECT status FROM executions WHERE id = ?")
      .get(executionId) as { status: string } | undefined;

    assert.ok(executingExecution, "Execution should exist");
    assert.strictEqual(executingExecution!.status, "executing", "Execution should still be in executing status despite expired lease");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});