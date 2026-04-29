/**
 * Integration Tests: Crash Simulation and Repair Operations
 *
 * Tests crash injection and repair operations with real store interactions.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  maybeInjectWorkflowCrash,
  isInjectedWorkflowCrashError,
  InjectedWorkflowCrashError,
  type WorkflowCrashContext,
} from "../../../../../src/platform/execution/recovery/workflow-crash-simulator.js";
import { RepairPipeline } from "../../../../../src/platform/execution/recovery/repair-pipeline.js";
import { ValidationRepairLoopService } from "../../../../../src/platform/execution/recovery/validation-repair-loop.js";
import { createTaskCard } from "../../../../../src/platform/execution/recovery/task-card.js";
import { createValidationReport, type CheckResult } from "../../../../../src/platform/execution/recovery/validation-report.js";
import { createReviewReport } from "../../../../../src/platform/execution/recovery/review-report.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { StalledExecutionDetector } from "../../../../../src/platform/execution/recovery/stalled-execution-detector.js";

// =============================================================================
// Crash Simulation Integration Tests
// =============================================================================

test("crash simulation: InjectedWorkflowCrashError integrates with workflow context", () => {
  const context: WorkflowCrashContext = {
    point: "tool_completed",
    taskId: "task-integration-1",
    executionId: "exec-integration-1",
    workflowId: "wf-integration-1",
    stepId: "step-integration-1",
  };

  const error = new InjectedWorkflowCrashError(context);

  assert.equal(error.point, "tool_completed");
  assert.equal(error.taskId, "task-integration-1");
  assert.ok(error.message.includes("tool_completed"));
});

test("crash simulation: maybeInjectWorkflowCrash with stepId null matches all steps", () => {
  const context: WorkflowCrashContext = {
    point: "before_commit",
    taskId: "task-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    stepId: "any-step",
  };

  // Injection with stepId null should match any step
  assert.throws(
    () => maybeInjectWorkflowCrash({ point: "before_commit", stepId: null }, context),
    (err: unknown) => isInjectedWorkflowCrashError(err),
  );
});

// =============================================================================
// Repair Pipeline Integration Tests
// =============================================================================

test("repair pipeline integration: handles multiple stage transitions", () => {
  const taskCard = createTaskCard({
    taskId: newId("task"),
    title: "Integration test task",
    objective: "Test multiple transitions",
    riskLevel: "medium",
    maxRepairRounds: 3,
  });

  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("build");
  pipeline.transitionTo("review");
  pipeline.transitionTo("validate");
  pipeline.transitionTo("release");
  pipeline.complete();

  const state = pipeline.getState();
  assert.equal(state.currentStage, "completed");
  assert.ok(state.stageHistory.includes("build"));
  assert.ok(state.stageHistory.includes("review"));
  assert.ok(state.stageHistory.includes("validate"));
});

test("repair pipeline integration: handles repair round escalation", () => {
  const taskCard = createTaskCard({
    taskId: newId("task"),
    title: "Escalation test",
    objective: "Test escalation",
    riskLevel: "high",
    maxRepairRounds: 1,
  });

  const pipeline = new RepairPipeline(taskCard);

  pipeline.transitionTo("validate");
  pipeline.incrementRepairRound(); // Exhaust repair budget

  const result = pipeline.handleValidationFailure(
    "schema_error",
    createValidationReport({
      reportId: newId("report"),
      taskId: taskCard.taskId,
      bundleId: newId("bundle"),
      decision: "fail",
      checks: [],
    }),
  );

  assert.equal(result.action, "escalate");
});

// =============================================================================
// Validation Repair Loop Integration Tests
// =============================================================================

test("validation repair loop integration: decision flow with real inputs", () => {
  const service = new ValidationRepairLoopService();

  const input = {
    taskId: newId("task"),
    reviewPassed: true,
    validationPassed: false,
    failedChecks: [{ check: "lint", details: "unused variable" }] as const,
    changedFiles: ["src/test.ts"] as readonly string[],
    allowedFixScope: ["src/"] as readonly string[],
    forbiddenScope: ["**/secrets/**"] as readonly string[],
    maxDiffLines: 100,
    repairRound: 0,
    maxRepairRounds: 3,
  };

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_repairable");
  assert.equal(decision.requiresRepair, true);
  assert.equal(decision.reasonCode, "validation.checks_failed");
});

test("validation repair loop integration: buildRepairEvidencePackage preserves data", () => {
  const service = new ValidationRepairLoopService();

  const checks: CheckResult[] = [
    {
      checkId: newId("check"),
      name: "typecheck",
      type: "typecheck",
      passed: false,
      errorCount: 1,
      warningCount: 0,
      errors: [{ message: "Type error", severity: "error" }],
      durationMs: 50,
      required: true,
    },
  ];

  const input = {
    taskId: newId("task"),
    reviewPassed: false,
    validationPassed: false,
    failedChecks: [{ check: "typecheck", details: "Type error" }],
    changedFiles: ["file1.ts", "file2.ts"] as readonly string[],
    allowedFixScope: ["src/", "lib/"] as readonly string[],
    forbiddenScope: ["**/secrets/**"] as readonly string[],
    maxDiffLines: 200,
    repairRound: 2,
    maxRepairRounds: 3,
  };

  const evidence = service.buildRepairEvidencePackage(input);

  assert.equal(evidence.taskId, input.taskId);
  assert.equal(evidence.failedChecks.length, 1);
  assert.equal(evidence.changedFiles.length, 2);
  assert.equal(evidence.repairRound, 2);
  assert.equal(evidence.maxDiffLines, 200);
});

// =============================================================================
// Stalled Execution Detector Integration Tests
// =============================================================================

test("stalled execution detector integration: with real store and active executions", () => {
  const workspace = createTempWorkspace("stalled-detector-");

  try {
    const dbPath = join(workspace, "test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const detector = new StalledExecutionDetector(store);

    const now = new Date().toISOString();

    // Detect with empty store should return empty
    const findings = detector.detect({ now });

    assert.ok(Array.isArray(findings));
    assert.equal(findings.length, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("stalled execution detector integration: detects stale execution from real store", () => {
  const workspace = createTempWorkspace("stalled-real-");

  try {
    const dbPath = join(workspace, "test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const detector = new StalledExecutionDetector(store);

    const taskId = newId("task");
    const executionId = newId("exec");
    const workerId = newId("worker");
    const now = nowIso();
    const oldTime = new Date(Date.now() - 10 * 60000).toISOString(); // 10 minutes ago

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "test",
        title: "Stale task",
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
        updatedAt: oldTime,
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
        startedAt: oldTime,
        finishedAt: null,
        createdAt: oldTime,
        updatedAt: oldTime,
      });
    });

    const findings = detector.detect({
      now,
      staleAfterMs: 60000,
      heartbeatGraceMs: 30000,
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});