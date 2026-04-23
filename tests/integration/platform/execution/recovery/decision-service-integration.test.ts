/**
 * Recovery Integration Test: Runtime Recovery Decision Service
 *
 * Tests the decision service's ability to make and apply recovery
 * decisions for executions in various failure states.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { RuntimeRecoveryDecisionService } from "../../../../../src/platform/execution/recovery/runtime-recovery-decision-service-root.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("recovery decision: decide() records decision event for execution error", () => {
  const workspace = createTempWorkspace("recovery-decision-");

  try {
    const dbPath = join(workspace, "decision-decide.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const decisionService = new RuntimeRecoveryDecisionService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Decision test",
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
    });

    const decision = decisionService.decide(executionId);

    assert.strictEqual(decision.executionId, executionId);
    assert.strictEqual(decision.taskId, taskId);
    assert.strictEqual(decision.decidedBy, "runtime_recovery_decision_service");
    assert.ok(decision.decisionId.startsWith("rdec_"));
    assert.ok(decision.reason.includes("execution_error"));

    // Verify event was recorded
    const events = store.event.listEventsForTask(taskId);
    const decisionEvents = events.filter((e) => e.eventType === "recovery:decision_recorded");
    assert.strictEqual(decisionEvents.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery decision: apply() cancels execution with cancel action", () => {
  const workspace = createTempWorkspace("recovery-decision-apply-");

  try {
    const dbPath = join(workspace, "decision-apply-cancel.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const decisionService = new RuntimeRecoveryDecisionService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Apply cancel test",
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

      // Insert execution with precheck that was denied
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Insert precheck with denial
      store.insertExecutionPrecheck({
        id: newId("precheck"),
        executionId,
        allowed: 0,
        reasonCode: "budget_exceeded",
        resolvedBudgetUsd: 0,
        resolvedTimeoutMs: 30000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: JSON.stringify([]),
        resolvedPathsJson: JSON.stringify([]),
        checkedAt: now,
      });
    });

    const result = decisionService.apply(executionId);

    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.decision.executionId, executionId);
    assert.strictEqual(result.decision.action, "cancel");
    assert.strictEqual(result.deadLetter, null);

    // Verify execution was updated
    const execution = store.dispatch.getExecution(executionId);
    assert.strictEqual(execution!.status, "cancelled");

    // Verify cancellation event was emitted
    const events = store.event.listEventsForTask(taskId);
    const cancelEvents = events.filter((e) => e.eventType === "recovery:cancelled");
    assert.strictEqual(cancelEvents.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery decision: apply() moves execution to dead letter queue", () => {
  const workspace = createTempWorkspace("recovery-decision-dlq-");

  try {
    const dbPath = join(workspace, "decision-dlq.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const decisionService = new RuntimeRecoveryDecisionService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Dead letter test",
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

      // High attempt execution that should go to DLQ
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
        attempt: 10, // High attempt count
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
    });

    const result = decisionService.apply(executionId);

    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.decision.action, "move_dead_letter");
    assert.ok(result.deadLetter, "Dead letter should be created");
    assert.strictEqual(result.deadLetter!.executionId, executionId);
    assert.strictEqual(result.deadLetter!.taskId, taskId);
    assert.strictEqual(result.deadLetter!.retryCount, 10);

    // Verify execution status updated to failed
    const execution = store.dispatch.getExecution(executionId);
    assert.strictEqual(execution!.status, "failed");

    // Verify dead letter event was emitted
    const events = store.event.listEventsForTask(taskId);
    const dlqEvents = events.filter((e) => e.eventType === "recovery:dead_lettered");
    assert.strictEqual(dlqEvents.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery decision: decide() throws for missing execution", () => {
  const workspace = createTempWorkspace("recovery-decision-missing-");

  try {
    const dbPath = join(workspace, "decision-missing.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const decisionService = new RuntimeRecoveryDecisionService(db, store);

    assert.throws(
      () => decisionService.decide("nonexistent-exec"),
      (err: any) => err.code === "storage.execution_not_found",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery decision: decide() throws when no recovery candidate found", () => {
  const workspace = createTempWorkspace("recovery-decision-nocandidate-");

  try {
    const dbPath = join(workspace, "decision-nocandidate.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const decisionService = new RuntimeRecoveryDecisionService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Insert execution in terminal state without being a recovery candidate
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "No candidate test",
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
    });

    assert.throws(
      () => decisionService.decide(executionId),
      (err: any) => err.code === "runtime.recovery_candidate_not_found",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery decision: decision event contains all required fields", () => {
  const workspace = createTempWorkspace("recovery-decision-fields-");

  try {
    const dbPath = join(workspace, "decision-fields.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const decisionService = new RuntimeRecoveryDecisionService(db, store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const decidedBy = "test_decider";
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Fields test",
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
        lastErrorMessage: "Error",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const decision = decisionService.decide(executionId, decidedBy);

    assert.ok(decision.decisionId.length > 0);
    assert.strictEqual(decision.executionId, executionId);
    assert.strictEqual(decision.taskId, taskId);
    assert.strictEqual(decision.decidedBy, decidedBy);
    assert.ok(decision.decidedAt.length > 0);
    assert.ok(decision.action.length > 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
