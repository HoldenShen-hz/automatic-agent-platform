/**
 * Recovery Integration Test: Runtime Recovery Replay Service
 *
 * Tests the replay service's ability to reconstruct recovery history
 * and generate diagnostic reports for executions and tasks.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { RuntimeRecoveryReplayService } from "../../../../../src/platform/execution/recovery/runtime-recovery-replay-service-root.js";
import { RuntimeRecoveryService } from "../../../../../src/platform/execution/recovery/runtime-recovery-service-root.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("recovery replay: builds task replay report with recovery events", () => {
  const workspace = createTempWorkspace("recovery-replay-");

  try {
    const dbPath = join(workspace, "replay-task.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const replayService = new RuntimeRecoveryReplayService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Replay test task",
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

      // Insert recovery decision event
      store.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: "recovery:decision_recorded",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          decisionId: newId("rdec"),
          action: "resume_same_worker",
          reason: "active_execution",
          decidedAt: now,
          decidedBy: "test_service",
        }),
        traceId: newId("trace"),
        createdAt: now,
      });

      // Insert repair applied event
      store.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          repairAction: "requeue_execution",
          targetId: executionId,
        }),
        traceId: newId("trace"),
        createdAt: now,
      });
    });

    const report = replayService.buildTaskReplayReport(taskId);

    assert.strictEqual(report.taskId, taskId);
    assert.strictEqual(report.divisionId, "general_ops");
    assert.strictEqual(report.candidateCount, 1);
    assert.strictEqual(report.recoveryEventCount, 2);
    assert.strictEqual(report.executions.length, 1);
    assert.strictEqual(report.executions[0]!.executionId, executionId);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery replay: detects dead letter outcome from events", () => {
  const workspace = createTempWorkspace("recovery-replay-dlq-");

  try {
    const dbPath = join(workspace, "replay-dlq.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const replayService = new RuntimeRecoveryReplayService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const deadLetterId = newId("dlq");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Dead letter test",
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
        lastErrorMessage: "Runtime error occurred",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Insert dead letter event
      store.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: "recovery:dead_lettered",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          decisionId: newId("rdec"),
          deadLetterId,
          finalReasonCode: "E1:runtime_error",
          retryCount: 1,
        }),
        traceId: newId("trace"),
        createdAt: now,
      });
    });

    const report = replayService.buildExecutionReplayReport(executionId);

    assert.strictEqual(report.executionId, executionId);
    assert.strictEqual(report.finalOutcome, "dead_lettered");
    assert.ok(report.deadLetter, "Dead letter should be present");
    assert.strictEqual(report.deadLetter!.id, deadLetterId);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery replay: detects cancelled outcome from execution status", () => {
  const workspace = createTempWorkspace("recovery-replay-cancelled-");

  try {
    const dbPath = join(workspace, "replay-cancelled.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const replayService = new RuntimeRecoveryReplayService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Cancelled test",
        status: "cancelled",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: "precheck_denied",
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
        status: "cancelled",
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
        lastErrorCode: "precheck_denied",
        lastErrorMessage: "Precheck was denied",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Insert cancellation event
      store.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: "recovery:cancelled",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          decisionId: newId("rdec"),
          action: "cancel",
          reason: "precheck_denied:budget_exceeded",
          decidedBy: "test_service",
        }),
        traceId: newId("trace"),
        createdAt: now,
      });
    });

    const report = replayService.buildExecutionReplayReport(executionId);

    assert.strictEqual(report.executionId, executionId);
    assert.strictEqual(report.finalOutcome, "cancelled");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery replay: determines repair_pending outcome when repairs applied", () => {
  const workspace = createTempWorkspace("recovery-replay-pending-");

  try {
    const dbPath = join(workspace, "replay-pending.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const replayService = new RuntimeRecoveryReplayService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Repair pending test",
        status: "pending",
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
        status: "created",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 2,
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Insert repair applied event
      store.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          repairAction: "requeue_execution",
          targetId: executionId,
        }),
        traceId: newId("trace"),
        createdAt: now,
      });
    });

    const report = replayService.buildExecutionReplayReport(executionId);

    assert.strictEqual(report.executionId, executionId);
    assert.strictEqual(report.finalOutcome, "repair_pending");
    assert.strictEqual(report.repairs.length, 1);
    assert.strictEqual(report.repairs[0]!.repairAction, "requeue_execution");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery replay: extracts timeline events in chronological order", () => {
  const workspace = createTempWorkspace("recovery-replay-timeline-");

  try {
    const dbPath = join(workspace, "replay-timeline.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const replayService = new RuntimeRecoveryReplayService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = new Date();
    const times = [
      new Date(now.getTime() - 30000).toISOString(), // 30s ago
      new Date(now.getTime() - 20000).toISOString(), // 20s ago
      new Date(now.getTime() - 10000).toISOString(), // 10s ago
    ];

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeline test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: times[0],
        updatedAt: times[0],
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
        startedAt: times[0],
        finishedAt: null,
        createdAt: times[0],
        updatedAt: times[0],
      });

      // Insert events in non-chronological order
      store.insertEvent({
        id: "evt-3",
        taskId,
        executionId,
        eventType: "recovery:dead_lettered",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ deadLetterId: newId("dlq") }),
        traceId: newId("trace"),
        createdAt: times[2],
      });

      store.insertEvent({
        id: "evt-1",
        taskId,
        executionId,
        eventType: "recovery:decision_recorded",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ action: "move_dead_letter" }),
        traceId: newId("trace"),
        createdAt: times[0],
      });

      store.insertEvent({
        id: "evt-2",
        taskId,
        executionId,
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({ repairAction: "requeue_execution" }),
        traceId: newId("trace"),
        createdAt: times[1],
      });
    });

    const report = replayService.buildExecutionReplayReport(executionId);

    // Timeline should be sorted by priority (repair=1, decision=2, cancelled=3, dead_lettered=4)
    assert.strictEqual(report.timeline.length, 3);
    assert.strictEqual(report.timeline[0]!.eventType, "recovery:repair_applied");
    assert.strictEqual(report.timeline[1]!.eventType, "recovery:decision_recorded");
    assert.strictEqual(report.timeline[2]!.eventType, "recovery:dead_lettered");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery replay: task outcome is mixed when executions have different outcomes", () => {
  const workspace = createTempWorkspace("recovery-replay-mixed-");

  try {
    const dbPath = join(workspace, "replay-mixed.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const replayService = new RuntimeRecoveryReplayService(store);

    const taskId = newId("task");
    const executionId1 = newId("exec1");
    const executionId2 = newId("exec2");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Mixed outcome test",
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

      // First execution - cancelled
      store.insertExecution({
        id: executionId1,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: newId("agent"),
        roleId: null,
        runKind: "task_run",
        status: "cancelled",
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
        lastErrorCode: "E1",
        lastErrorMessage: "Error",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Second execution - still active
      store.insertExecution({
        id: executionId2,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: newId("agent"),
        roleId: null,
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 2,
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
    });

    const report = replayService.buildTaskReplayReport(taskId);

    assert.strictEqual(report.outcome, "mixed");
    assert.strictEqual(report.executions.length, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
