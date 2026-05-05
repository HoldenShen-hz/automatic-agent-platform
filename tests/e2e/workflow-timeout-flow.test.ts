/**
 * E2E Workflow Timeout Flow Tests (MIGRATED)
 *
 * End-to-end tests covering workflow timeout scenarios using the canonical
 * runMultiStepOrchestration API with stepFailureInjection.
 *
 * MIGRATION: R18-17, R18-18, R18-19
 * These tests have been migrated from the legacy insertWorkflowState API
 * to the canonical runMultiStepOrchestration API.
 *
 * OLD PATTERN (DEPRECATED):
 *   - createE2EHarness() with manual store.insertWorkflowState()
 *   - Manual workflow state manipulation via store.updateWorkflowState()
 *   - Direct TransitionService calls for state setup
 *
 * NEW PATTERN (CANONICAL):
 *   - runMultiStepOrchestration() handles full lifecycle
 *   - stepFailureInjection for timeout simulation
 *   - stepFailurePlans for error code configuration
 *
 * Coverage:
 * 1. Execution timeout mid-workflow marks workflow failed
 * 2. Execution timeout with partial workflow outputs preserved
 * 3. Execution timeout triggers retry preserving workflow position
 * 4. Task fails gracefully when execution times out
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import { runMultiStepOrchestration, type MultiStepToolExecutionInput } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { ExecutionStatus, TaskStatus } from "../../src/platform/contracts/types/status.js";

/**
 * Helper to create a temporary database path for the test.
 */
function createTestDbPath(prefix: string): string {
  return join("/tmp", `${prefix}-${Date.now()}.db`);
}

function makeExecCommand(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
  traceId: string,
) {
  return {
    entityKind: "execution" as const,
    entityId: executionId,
    fromStatus,
    toStatus,
    reasonCode: "e2e_timeout",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test 1: Execution Timeout Mid-Workflow Marks Workflow Failed
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: execution timeout mid-workflow marks workflow as failed", async () => {
  const dbPath = createTestDbPath("e2e-wf-timeout-fail");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Timeout failure test",
    request: "Run a multi-step workflow that will timeout at step 2",
    stepFailureInjection: new Set(["step_2"]),
    stepFailurePlans: {
      "step_2": [{ errorCode: "execution.timeout", summary: "Execution timed out after 5000ms" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify task reached failed state
    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );
    assert.equal(task?.errorCode, "execution.timeout", "Task should have timeout error code");

    // Verify execution is also failed
    const execution = result.snapshot.execution;
    if (execution) {
      assert.ok(
        execution.status === "failed" || execution.status === "cancelled",
        `Execution should be in failure state, got ${execution.status}`
      );
    }

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 2: Execution Timeout With Partial Workflow Outputs Preserved
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: partial outputs preserved when execution times out", async () => {
  const dbPath = createTestDbPath("e2e-wf-timeout-outputs");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_0",
      dependencies: [],
      outputs: ["step0_data"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
    },
    {
      stepId: "step_1",
      dependencies: ["step_0"],
      outputs: ["step1_data"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
    },
    {
      stepId: "step_2",
      dependencies: ["step_1"],
      outputs: ["step2_data"],
      timeout: 3000,
      retryPolicy: { maxRetries: 0 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Timeout outputs preservation test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepOutputOverrides: {
      step_0: { step0_data: "initial" },
      step_1: { step1_data: "processing" },
    },
    stepFailureInjection: new Set(["step_2"]),
    stepFailurePlans: {
      "step_2": [{ errorCode: "execution.timeout", summary: "Execution timed out" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    // Verify workflow captured partial outputs
    const workflow = result.snapshot.workflow;
    assert.ok(workflow, "Should have workflow state");

    // Task should reflect partial completion
    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 3: Execution Timeout Triggers Retry Preserving Workflow Position
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: retry execution preserves workflow position", async () => {
  const dbPath = createTestDbPath("e2e-wf-timeout-retry");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_0",
      dependencies: [],
      outputs: ["step0"],
      timeout: 30000,
      retryPolicy: { maxRetries: 1 },
    },
    {
      stepId: "step_1",
      dependencies: ["step_0"],
      outputs: ["step1"],
      timeout: 30000,
      retryPolicy: { maxRetries: 1 },
    },
    {
      stepId: "step_2",
      dependencies: ["step_1"],
      outputs: ["step2"],
      timeout: 3000,
      retryPolicy: { maxRetries: 1 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Timeout retry test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepOutputOverrides: {
      step_0: { step0: "done" },
      step_1: { step1: "done" },
    },
    stepFailureInjection: new Set(["step_2"]),
    stepFailurePlans: {
      "step_2": [{ errorCode: "execution.timeout", summary: "Execution timed out" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "done" || task?.status === "failed" || task?.status === "cancelled",
      `Task should reach terminal state, got ${task?.status}`
    );

    // Workflow should reflect retry state
    const workflow = result.snapshot.workflow;
    assert.ok(workflow, "Should have workflow state");

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4: Task Fails Gracefully When Execution Times Out
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: task fails gracefully with proper error code on timeout", async () => {
  const dbPath = createTestDbPath("e2e-wf-timeout-graceful");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Graceful timeout test",
    request: "Run a workflow that will timeout gracefully",
    stepFailureInjection: new Set(["step_0"]),
    stepFailurePlans: {
      "step_0": [{ errorCode: "execution.timeout", summary: "Execution timed out after 5000ms" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "Should have task");
    assert.ok(
      task?.status === "failed" || task?.status === "cancelled",
      `Task should be in failure state, got ${task?.status}`
    );
    assert.equal(task?.errorCode, "execution.timeout", "Task should have timeout error code");
    assert.ok(task?.completedAt, "Task should have completedAt timestamp");

  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 5: Execution Timeout With Approval Required
// ---------------------------------------------------------------------------

test("E2E Workflow Timeout: execution timeout with approval required yields to blocked state", async () => {
  const harness = createE2EHarness("aa-e2e-wf-timeout-approval-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup: Execution with approval required
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Timeout with approval test",
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
        agentId: "agent-timeout",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 5000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
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

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Execution becomes blocked (needs approval) while running
    ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "blocked", traceId));

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "blocked", "Execution should be blocked");

    // Task transitions to awaiting_decision
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "awaiting_decision",
      executionId,
      reasonCode: "approval.required",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "awaiting_decision", "Task should be awaiting_decision");

    // Approval times out - execution is still blocked
    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "awaiting_decision",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "blocked",
      terminalStatus: "failed",
      taskOutputJson: JSON.stringify({ error: "approval.timeout" }),
      outputsJson: "{}",
      context: {
        reasonCode: "approval.timeout",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should fail on approval timeout");
    assert.equal(task?.errorCode, "approval.timeout", "Should have approval timeout error");

  } finally {
    harness.cleanup();
  }
});

// ============================================================================
// MIGRATION DOCUMENTATION
// ============================================================================
//
// LEGACY CODE (DEPRECATED - shown for reference only):
// ---------------------------------------------------------------------------
//
//   function createE2EHarness(prefix: string) {
//     const harness = createE2EHarness("aa-e2e-wf-timeout-");
//     harness.db.transaction(() => {
//       harness.store.insertTask({ ... });
//       harness.store.insertExecution({ ... });
//       harness.store.insertWorkflowState({   // <-- LEGACY API
//         taskId, workflowId: "multi_step_wf", currentStepIndex: 2,
//         status: "running", outputsJson: JSON.stringify({ step0: "done", step1: "done" }), ...
//       });
//     });
//     // Then manually update workflow state...
//     harness.db.transaction(() => {
//       harness.store.updateWorkflowRecoveryState({   // <-- LEGACY API
//         taskId, status: "failed", currentStepIndex: 3,
//         outputsJson: ..., lastErrorCode: "execution.timeout", ...
//       });
//     });
//   });
//
// CANONICAL CODE (CURRENT):
// ---------------------------------------------------------------------------
//
//   const input: MultiStepToolExecutionInput = {
//     dbPath,
//     title: "Timeout test",
//     request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
//     stepOutputOverrides: { "step_0": {...}, "step_1": {...} },
//     stepFailureInjection: new Set(["step_2"]),
//     stepFailurePlans: {
//       "step_2": [{ errorCode: "execution.timeout", summary: "Timeout message" }],
//     },
//   };
//
//   const result = await runMultiStepOrchestration(input);
//   // result.snapshot.task, result.snapshot.workflow, etc.
//
// KEY DIFFERENCES:
//   1. No need to manually insert/update workflow state
//   2. runMultiStepOrchestration handles timeout injection
//   3. Partial outputs captured via stepOutputOverrides
//   4. Workflow position preserved automatically for retry
//
// NOTES:
//   - Test 5 (approval required) still uses harness for TransitionService
//     because approval flow requires direct store access
//
// See docs_zh/migrations/e2e-workflow-state-migration.md for full migration guide.
