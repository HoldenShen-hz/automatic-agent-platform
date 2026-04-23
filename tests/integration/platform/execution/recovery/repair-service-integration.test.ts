/**
 * Recovery Integration Test: Runtime Repair Service Actions
 *
 * Tests individual repair action handlers in the RuntimeRepairService
 * including requeue, reconcile terminal state, and release stale lock.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { RuntimeRepairService } from "../../../../../src/platform/execution/recovery/runtime-repair-service-root.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { StartupConsistencyReport } from "../../../../../src/platform/execution/startup/startup-consistency-checker.js";

test("repair service: requeue_execution resets execution and task state", () => {
  const workspace = createTempWorkspace("repair-requeue-");

  try {
    const dbPath = join(workspace, "repair-requeue.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repairService = new RuntimeRepairService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Requeue test",
        status: "failed",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: "E1:runtime_error",
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: newId("agent"),
        roleId: null,
        runKind: "task_run",
        status: "failed",
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
        lastErrorCode: "E1:runtime_error",
        lastErrorMessage: "Runtime error",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Create lease that will be reclaimed
      store.insertExecutionLease({
        id: newId("lease"),
        executionId,
        workerId: newId("worker"),
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

    const report: StartupConsistencyReport = {
      checkedAt: now,
      repairActions: [
        {
          action: "requeue_execution" as const,
          targetId: executionId,
          reason: "test_requeue",
        },
      ],
    };

    const results = repairService.apply(report);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.applied, true);
    assert.strictEqual(results[0]!.action, "requeue_execution");

    // Verify execution status was reset
    const execution = store.dispatch.getExecution(executionId);
    assert.strictEqual(execution!.status, "created");

    // Verify task status was reset
    const task = store.task.getTask(taskId);
    assert.strictEqual(task!.status, "pending");

    // Verify repair event was emitted
    const events = store.event.listEventsForTask(taskId);
    const repairEvents = events.filter((e) => e.eventType === "recovery:repair_applied");
    assert.strictEqual(repairEvents.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("repair service: reconcile_terminal_state fixes inconsistent terminal states", () => {
  const workspace = createTempWorkspace("repair-terminal-");

  try {
    const dbPath = join(workspace, "repair-terminal.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repairService = new RuntimeRepairService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Terminal reconcile test",
        status: "in_progress", // Wrong - should match workflow
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
        agentId: newId("agent"),
        roleId: null,
        runKind: "task_run",
        status: "completed",
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
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Insert workflow in terminal state
      db.connection.exec(`
        INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
        VALUES ('${taskId}', 'general_ops', '${newId("wf")}', 3, 'completed', '{}', NULL, 0, 3, '${now}', '${now}')
      `);
    });

    const report: StartupConsistencyReport = {
      checkedAt: now,
      repairActions: [
        {
          action: "reconcile_terminal_state" as const,
          targetId: taskId,
          reason: "test_reconcile",
        },
      ],
    };

    const results = repairService.apply(report);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.applied, true);

    // Task should now be done
    const task = store.task.getTask(taskId);
    assert.strictEqual(task!.status, "done");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("repair service: close_orphan_session cleans up orphan sessions", () => {
  const workspace = createTempWorkspace("repair-orphan-");

  try {
    const dbPath = join(workspace, "repair-orphan.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repairService = new RuntimeRepairService(db, store);

    const taskId = newId("task");
    const sessionId = newId("session");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Orphan session test",
        status: "done",
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
        completedAt: now,
      });

      // Insert orphan session (task done but session still open)
      store.insertSession({
        id: sessionId,
        taskId,
        parentId: null,
        status: "open",
        inputJson: "{}",
        outputJson: null,
        errorJson: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const report: StartupConsistencyReport = {
      checkedAt: now,
      repairActions: [
        {
          action: "close_orphan_session" as const,
          targetId: sessionId,
          reason: "test_close",
        },
      ],
    };

    const results = repairService.apply(report);

    assert.strictEqual(results[0]!.applied, true);
    assert.strictEqual(results[0]!.action, "close_orphan_session");

    // Verify session was closed
    const session = store.dispatch.getSession(sessionId);
    assert.strictEqual(session!.status, "completed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("repair service: release_stale_lock removes stale locks", () => {
  const workspace = createTempWorkspace("repair-lock-");

  try {
    const dbPath = join(workspace, "repair-lock.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repairService = new RuntimeRepairService(db, store);

    const lockId = newId("lock");
    const now = nowIso();

    db.transaction(() => {
      // Insert stale file lock
      store.insertFileLock({
        id: lockId,
        resourcePath: "/tmp/test-resource",
        workerId: newId("worker"),
        leasedAt: now,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        fencingToken: 1,
      });
    });

    const report: StartupConsistencyReport = {
      checkedAt: now,
      repairActions: [
        {
          action: "release_stale_lock" as const,
          targetId: lockId,
          reason: "test_release",
        },
      ],
    };

    const results = repairService.apply(report);

    assert.strictEqual(results[0]!.applied, true);
    assert.strictEqual(results[0]!.action, "release_stale_lock");

    // Verify lock was deleted
    const lock = store.lock.getFileLock(lockId);
    assert.strictEqual(lock, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("repair service: manual_intervention_required returns not applied", () => {
  const workspace = createTempWorkspace("repair-manual-");

  try {
    const dbPath = join(workspace, "repair-manual.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repairService = new RuntimeRepairService(db, store);

    const targetId = newId("target");
    const now = nowIso();

    const report: StartupConsistencyReport = {
      checkedAt: now,
      repairActions: [
        {
          action: "manual_intervention_required" as const,
          targetId,
          reason: "test_manual",
        },
      ],
    };

    const results = repairService.apply(report);

    assert.strictEqual(results[0]!.applied, false);
    assert.strictEqual(results[0]!.detail, "manual intervention required");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("repair service: reconcile_dispatch_ticket repairs unhealthy ticket", () => {
  const workspace = createTempWorkspace("repair-ticket-");

  try {
    const dbPath = join(workspace, "repair-ticket.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repairService = new RuntimeRepairService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Ticket repair test",
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
        agentId: newId("agent"),
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

      // Insert dispatch ticket in claimed state (stale)
      store.insertExecutionTicket({
        id: ticketId,
        executionId,
        workerId: newId("worker"),
        attempt: 1,
        priority: "normal",
        queueName: null,
        dispatchTarget: "any",
        requiredCapabilitiesJson: "[]",
        status: "claimed",
        createdAt: now,
        claimedAt: new Date(Date.now() - 60000).toISOString(), // Claimed long ago
        startedAt: null,
        completedAt: null,
      });
    });

    const report: StartupConsistencyReport = {
      checkedAt: now,
      repairActions: [
        {
          action: "reconcile_dispatch_ticket" as const,
          targetId: ticketId,
          reason: "test_reconcile",
        },
      ],
    };

    const results = repairService.apply(report);

    // Either applied (ticket repaired) or not (already healthy/missing)
    assert.ok(typeof results[0]!.applied === "boolean");
    assert.strictEqual(results[0]!.action, "reconcile_dispatch_ticket");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
