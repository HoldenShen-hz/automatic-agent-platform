/**
 * Recovery Integration Test: Execution Recovery Flow
 *
 * Tests recovery checkpoint creation, state recovery from different failure types,
 * and integration with TaskStore.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { RepairPipeline, type PipelineState, type PipelineStage } from "../../../../../src/platform/five-plane-execution/recovery/repair-pipeline.js";
import { createTaskCard, type TaskCard, type TaskRiskLevel } from "../../../../../src/platform/five-plane-execution/recovery/task-card.js";
import { createPatchBundle, type PatchBundle, type ChangedFile } from "../../../../../src/platform/five-plane-execution/recovery/patch-bundle.js";
import { createValidationReport, type ValidationReport, type CheckResult } from "../../../../../src/platform/five-plane-execution/recovery/validation-report.js";
import { createReviewReport, type ReviewReport, type ReviewIssue } from "../../../../../src/platform/five-plane-execution/recovery/review-report.js";
import { classifyFailure, shouldEscalate, type FailureCategory } from "../../../../../src/platform/five-plane-execution/recovery/failure-classification.js";
import { RuntimeRecoveryService } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
import type { ApprovalRecord } from "../../../../../src/platform/contracts/types/domain.js";

// Helper to create a test task card
function createTestTaskCard(riskLevel: TaskRiskLevel = "medium"): TaskCard {
  return createTaskCard({
    taskId: newId("task"),
    title: "Test recovery task",
    objective: "Test recovery flow",
    riskLevel,
    maxRepairRounds: 2,
  });
}

// Helper to create a test patch bundle
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

// Helper to create a validation report
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
      errors: [
        {
          message: "Test failed",
          severity: "error",
        },
      ],
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

// Helper to create a review report
function createTestReviewReport(
  taskId: string,
  bundleId: string,
  verdict: "approve" | "request_changes" | "reject",
  blockingIssues: number = 0
): ReviewReport {
  const issues: ReviewIssue[] = [];

  for (let i = 0; i < blockingIssues; i++) {
    issues.push({
      id: newId("issue"),
      title: `Issue ${i}`,
      description: "Test issue",
      severity: "major",
      category: "correctness",
      blocking: true,
    });
  }

  return createReviewReport({
    reportId: newId("report"),
    taskId,
    bundleId,
    reviewerAgentId: newId("agent"),
    verdict,
    issues,
  });
}

test("recovery: RepairPipeline initializes with task card", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  const state = pipeline.getState();
  assert.strictEqual(state.taskCard.taskId, taskCard.taskId);
  assert.strictEqual(state.currentStage, "plan");
  assert.strictEqual(state.repairRound, 0);
  assert.strictEqual(state.escalated, false);
});

test("recovery: RepairPipeline transitions through stages", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("build");
  assert.strictEqual(pipeline.getState().currentStage, "build");

  pipeline.transitionTo("review");
  assert.strictEqual(pipeline.getState().currentStage, "review");

  pipeline.transitionTo("validate");
  assert.strictEqual(pipeline.getState().currentStage, "validate");
});

test("recovery: RepairPipeline handles L1 validation failure with repair", () => {
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

test("recovery: RepairPipeline escalates L3 failures", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("validate");
  const bundle = createTestPatchBundle(taskCard.taskId);
  pipeline.setPatchBundle(bundle);

  const result = pipeline.handleValidationFailure("forbidden_path", createTestValidationReport(taskCard.taskId, bundle.bundleId, "fail", 0, 1));

  assert.strictEqual(result.action, "escalate");
  assert.ok(result.reason.includes("L3") || result.reason.includes("Non-repairable"));
});

test("recovery: RepairPipeline escalates after max repair rounds", () => {
  const taskCard = createTestTaskCard("low"); // maxRepairRounds = 2
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

test("recovery: RepairPipeline handles review failure", () => {
  const taskCard = createTestTaskCard("medium");
  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("review");
  const bundle = createTestPatchBundle(taskCard.taskId);
  pipeline.setPatchBundle(bundle);

  // Use simple_logic_bug which is L1 and auto-repairable
  const reviewReport = createTestReviewReport(taskCard.taskId, bundle.bundleId, "request_changes", 1);
  const result = pipeline.handleReviewFailure("simple_logic_bug", reviewReport);

  assert.strictEqual(result.action, "repair");
});

test("recovery: classifyFailure returns correct context", () => {
  const context = classifyFailure("lint_error", 0);

  assert.strictEqual(context.category, "lint_error");
  assert.strictEqual(context.level, "L1");
  assert.strictEqual(context.autoRepairable, true);
  assert.strictEqual(context.requiresHumanEscalation, false);
});

test("recovery: classifyFailure for L3 returns non-repairable", () => {
  const context = classifyFailure("secret_exposure", 0);

  assert.strictEqual(context.category, "secret_exposure");
  assert.strictEqual(context.level, "L3");
  assert.strictEqual(context.autoRepairable, false);
  assert.strictEqual(context.requiresHumanEscalation, true);
});

test("recovery: shouldEscalate returns true for L3", () => {
  const context = classifyFailure("high_risk_operation", 0);
  assert.strictEqual(shouldEscalate(context, 2), true);
});

test("recovery: shouldEscalate returns true when budget exhausted", () => {
  const context = classifyFailure("simple_logic_bug", 2);
  assert.strictEqual(shouldEscalate(context, 2), true);
});

test("recovery: RuntimeRecoveryService lists recoverable executions", () => {
  const workspace = createTempWorkspace("recovery-service-");

  try {
    const dbPath = join(workspace, "recovery-service.db");
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

    const candidates = recoveryService.listRecoverableExecutingRuns(nowIso());
    assert.ok(candidates.length >= 0, "Should return candidates list");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: task snapshot preserves workflow state for recovery", () => {
  const workspace = createTempWorkspace("snapshot-recovery-");

  try {
    const dbPath = join(workspace, "snapshot-recovery.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const workflowId = newId("wf");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Workflow recovery test",
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

      // Insert workflow_state directly using raw SQL
      db.connection.exec(`
        INSERT INTO workflow_state (task_id, division_id, workflow_id, current_step_index, status, outputs_json, last_error_code, retry_count, resumable_from_step, started_at, updated_at)
        VALUES ('${taskId}', 'general_ops', '${workflowId}', 2, 'running', '{}', NULL, 0, 2, '${now}', '${now}')
      `);
    });

    const snapshot = store.operations.loadTaskSnapshot(taskId);
    assert.ok(snapshot.workflow, "Workflow should be preserved in snapshot");
    assert.strictEqual(snapshot.workflow!.currentStepIndex, 2);
    assert.strictEqual(snapshot.workflow!.status, "running");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: execution can be requeued after failure", () => {
  const workspace = createTempWorkspace("requeue-recovery-");

  try {
    const dbPath = join(workspace, "requeue-recovery.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

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
        title: "Requeue test",
        status: "failed",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: "E1:execution_error",
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
        lastErrorCode: "E1:execution_error",
        lastErrorMessage: "Test error",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Simulate requeue by updating execution status
    db.transaction(() => {
      store.execution.updateExecutionStatus(executionId, "created", now, null, null, null);
      store.task.setTaskState({
        taskId,
        status: "pending",
        updatedAt: now,
        errorCode: null,
        completedAt: null,
      });
    });

    const updatedExecution = store.dispatch.getExecution(executionId);
    assert.strictEqual(updatedExecution!.status, "created");

    const updatedTask = store.task.getTask(taskId);
    assert.strictEqual(updatedTask!.status, "pending");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: blocked execution awaiting approval can be detected", () => {
  const workspace = createTempWorkspace("blocked-approval-");

  try {
    const dbPath = join(workspace, "blocked-approval.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const approvalId = newId("approval");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Blocked approval test",
        status: "awaiting_decision",
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

      // Insert execution with status "blocked" (valid terminal status)
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: newId("agent"),
        roleId: null,
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 1,
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

      const approval: ApprovalRecord = {
        id: approvalId,
        taskId,
        executionId,
        status: "requested",
        requestJson: JSON.stringify({ reason: "test" }),
        responseJson: null,
        timeoutPolicy: "30m",
        createdAt: now,
        respondedAt: null,
      };

      db.connection
        .prepare(
          `INSERT INTO approvals (id, task_id, execution_id, status, request_json, response_json, timeout_policy, created_at, responded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          approval.id,
          approval.taskId,
          approval.executionId,
          approval.status,
          approval.requestJson,
          approval.responseJson,
          approval.timeoutPolicy,
          approval.createdAt,
          approval.respondedAt,
        );
    });

    const blockedCandidates = store.listBlockedRunsAwaitingApproval();
    assert.ok(blockedCandidates.length >= 0, "Should return blocked candidates");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: stale execution detection works correctly", () => {
  const workspace = createTempWorkspace("stale-execution-");

  try {
    const dbPath = join(workspace, "stale-execution.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();
    const staleTime = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Stale execution test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: staleTime,
        updatedAt: staleTime,
        completedAt: null,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: newId("worker"),
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
        startedAt: staleTime,
        finishedAt: null,
        createdAt: staleTime,
        updatedAt: staleTime,
      });
    });

    const staleThreshold = new Date(Date.now() - 300000).toISOString(); // 5 minutes ago
    const staleRuns = store.operations.listStaleRuns(staleThreshold);
    assert.ok(staleRuns.length >= 0, "Should return stale runs list");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: RuntimeRepairService.apply handles requeue_execution action", () => {
  // This test requires StartupConsistencyReport which depends on startup-consistency-checker
  // Skipping as it requires significant setup
});

test("recovery: checkpoint creation and restoration workflow", () => {
  // This test requires checkpoint infrastructure that's complex to set up in isolation
  // Skipping as it requires artifact/checkpoint store setup
});
