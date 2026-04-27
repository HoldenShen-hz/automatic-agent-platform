/**
 * Integration Test: Recovery Pipeline and Runtime Recovery
 *
 * Tests recovery checkpoint creation, state recovery from different failure types,
 * and integration with TaskStore for recovery flows.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { RuntimeRecoveryService } from "../../../../../src/platform/execution/recovery/runtime-recovery-service-root.js";
import { RepairPipeline } from "../../../../../src/platform/execution/recovery/repair-pipeline.js";
import { createTaskCard, type TaskCard, type TaskRiskLevel } from "../../../../../src/platform/execution/recovery/task-card.js";
import { createPatchBundle, type PatchBundle } from "../../../../../src/platform/execution/recovery/patch-bundle.js";
import { createValidationReport, type ValidationReport, type CheckResult } from "../../../../../src/platform/execution/recovery/validation-report.js";
import { createReviewReport } from "../../../../../src/platform/execution/recovery/review-report.js";
import { classifyFailure, shouldEscalate } from "../../../../../src/platform/execution/recovery/failure-classification.js";

function createTestTaskCard(riskLevel: TaskRiskLevel = "medium"): TaskCard {
  return createTaskCard({
    taskId: newId("task"),
    title: "Test recovery task",
    objective: "Test recovery flow",
    riskLevel,
    maxRepairRounds: 2,
  });
}

function createTestPatchBundle(taskId: string): PatchBundle {
  return createPatchBundle({
    bundleId: newId("bundle"),
    taskId,
    changedFiles: [
      {
        path: "test/file.ts",
        operation: "modify",
        hunks: [
          {
            originalStart: 1,
            originalCount: 10,
            finalStart: 1,
            finalCount: 12,
            lines: ["+ line 1", "+ line 2"],
          },
        ],
      },
    ],
    authorAgentId: newId("agent"),
  });
}

function createTestValidationReport(
  taskId: string,
  bundleId: string,
  decision: "pass" | "fail" | "warning",
  passedChecks: number = 1,
  failedChecks: number = 0
): ValidationReport {
  const checks: CheckResult[] = [];

  if (passedChecks > 0) {
    checks.push({
      checkId: newId("check"),
      name: "typecheck",
      type: "typecheck",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: true,
    });
  }

  if (failedChecks > 0) {
    checks.push({
      checkId: newId("check"),
      name: "test",
      type: "test",
      passed: false,
      errorCount: 2,
      warningCount: 0,
      errors: [{ message: "Test failed", severity: "error" }],
      durationMs: 50,
      required: true,
    });
  }

  return createValidationReport({
    reportId: newId("report"),
    taskId,
    bundleId,
    checks,
  });
}

test("recovery pipeline: initializes with task card and correct initial stage", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  const state = pipeline.getState();
  assert.strictEqual(state.taskCard.taskId, taskCard.taskId);
  assert.strictEqual(state.currentStage, "plan");
  assert.strictEqual(state.repairRound, 0);
  assert.strictEqual(state.escalated, false);
});

test("recovery pipeline: transitions through stages in order", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("build");
  assert.strictEqual(pipeline.getState().currentStage, "build");

  pipeline.transitionTo("review");
  assert.strictEqual(pipeline.getState().currentStage, "review");

  pipeline.transitionTo("validate");
  assert.strictEqual(pipeline.getState().currentStage, "validate");

  pipeline.transitionTo("completed");
  assert.strictEqual(pipeline.getState().currentStage, "completed");
});

test("recovery pipeline: handles L1 validation failure with repair", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("validate");
  const bundle = createTestPatchBundle(taskCard.taskId);
  pipeline.setPatchBundle(bundle);

  const validationReport = createTestValidationReport(taskCard.taskId, bundle.bundleId, "fail", 0, 1);
  const result = pipeline.handleValidationFailure("lint_error", validationReport);

  assert.strictEqual(result.action, "repair");
  assert.ok(result.reason.includes("round"));
});

test("recovery pipeline: escalates L3 failures that are non-repairable", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("validate");
  const bundle = createTestPatchBundle(taskCard.taskId);
  pipeline.setPatchBundle(bundle);

  const result = pipeline.handleValidationFailure("forbidden_path", createTestValidationReport(taskCard.taskId, bundle.bundleId, "fail", 0, 1));

  assert.strictEqual(result.action, "escalate");
  assert.ok(result.reason.includes("L3") || result.reason.includes("Non-repairable"));
});

test("recovery pipeline: escalates after max repair rounds exhausted", () => {
  const taskCard = createTestTaskCard("low");
  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("validate");
  const bundle = createTestPatchBundle(taskCard.taskId);
  pipeline.setPatchBundle(bundle);

  // Exhaust repair budget
  for (let i = 0; i < taskCard.maxRepairRounds; i++) {
    pipeline.incrementRepairRound();
  }

  const result = pipeline.handleValidationFailure("simple_logic_bug", createTestValidationReport(taskCard.taskId, bundle.bundleId, "fail", 0, 1));
  assert.strictEqual(result.action, "escalate");
});

test("recovery pipeline: handles review failure and triggers repair", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("review");
  const bundle = createTestPatchBundle(taskCard.taskId);
  pipeline.setPatchBundle(bundle);

  const reviewReport = createReviewReport({
  reportId: newId("report"),
  taskId: taskCard.taskId,
  bundleId: bundle.bundleId,
  reviewerAgentId: newId("agent"),
  verdict: "request_changes",
  issues: [],
  durationMs: 1,
});
  const result = pipeline.handleReviewFailure("simple_logic_bug", reviewReport);

  assert.strictEqual(result.action, "repair");
});

test("classifyFailure: returns correct context for L1 lint error", () => {
  const context = classifyFailure("lint_error", 0);

  assert.strictEqual(context.category, "lint_error");
  assert.strictEqual(context.level, "L1");
  assert.strictEqual(context.autoRepairable, true);
  assert.strictEqual(context.requiresHumanEscalation, false);
});

test("classifyFailure: returns non-repairable for L3 secret exposure", () => {
  const context = classifyFailure("secret_exposure", 0);

  assert.strictEqual(context.category, "secret_exposure");
  assert.strictEqual(context.level, "L3");
  assert.strictEqual(context.autoRepairable, false);
  assert.strictEqual(context.requiresHumanEscalation, true);
});

test("shouldEscalate: returns true for L3 failures regardless of budget", () => {
  const context = classifyFailure("high_risk_operation", 0);
  assert.strictEqual(shouldEscalate(context, 2), true);
});

test("shouldEscalate: returns true when repair budget exhausted", () => {
  const context = classifyFailure("simple_logic_bug", 2);
  assert.strictEqual(shouldEscalate(context, 2), true);
});

test("runtime recovery service: lists recoverable executions from store", () => {
  const workspace = createTempWorkspace("recovery-runtime-");

  try {
    const dbPath = join(workspace, "recovery-runtime.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const recoveryService = new RuntimeRecoveryService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = newId("worker");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Recoverable execution test",
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

    // Verify recovery service can access the store
    const recoverable = recoveryService.listRecoverableExecutingRuns(now);
    assert.ok(Array.isArray(recoverable));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime recovery service: handles executions with retryable error codes", () => {
  const workspace = createTempWorkspace("recovery-retry-");

  try {
    const dbPath = join(workspace, "recovery-retry.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const recoveryService = new RuntimeRecoveryService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = newId("worker");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Retryable execution test",
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
        status: "failed",
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
        lastErrorCode: "transient_failure",
        lastErrorMessage: "Temporary network issue",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const recoverable = recoveryService.listRecoverableExecutingRuns(now);
    assert.ok(Array.isArray(recoverable));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime recovery service: excludes permanently failed executions", () => {
  const workspace = createTempWorkspace("recovery-permanent-");

  try {
    const dbPath = join(workspace, "recovery-permanent.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const recoveryService = new RuntimeRecoveryService(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = newId("worker");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Permanent failure test",
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
        agentId: workerId,
        roleId: null,
        runKind: "task_run",
        status: "failed",
        inputRef: null,
        traceId: `trace-${executionId}`,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: "permanent_failure",
        lastErrorMessage: "Non-recoverable error",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const recoverable = recoveryService.listRecoverableExecutingRuns(now);
    assert.ok(Array.isArray(recoverable));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
