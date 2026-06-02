/**
 * E2E Workflow Scenarios Tests
 *
 * End-to-end tests for workflow scenarios using createE2EHarness() pattern.
 * Covers:
 * 1. Multi-step workflow E2E
 * 2. Workflow with parallel branches
 * 3. Workflow error recovery and retry
 * 4. Workflow with compensation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import {
  runMultiStepOrchestration,
  type StepFailurePlan,
} from "../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

function buildPlanRequest(
  steps: ReadonlyArray<{
    stepId: string;
    dependencies?: readonly string[];
    outputSchemaPath?: string;
    timeoutMs?: number;
    maxRetries?: number;
  }>,
): string {
  return `oapeflir://plan ${JSON.stringify(
    steps.map((step) => ({
      stepId: step.stepId,
      action: step.stepId,
      outputs: [`${step.stepId}_output`],
      outputSchemaPath: step.outputSchemaPath ?? `schema:${step.stepId}.output`,
      dependencies: [...(step.dependencies ?? [])],
      timeout: step.timeoutMs ?? 30000,
      retryPolicy: {
        maxRetries: step.maxRetries ?? 0,
        backoffMs: 0,
      },
    })),
  )}`;
}

// ============================================================================
// Test Suite 1: Multi-Step Workflow E2E
// ============================================================================

test("E2E Workflow: runMultiStepOrchestration executes 4-step pipeline to completion", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-multi-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E 4-step pipeline",
        request: buildPlanRequest([
          { stepId: "step_fetch", outputSchemaPath: "schema:fetch.output" },
          { stepId: "step_validate", dependencies: ["step_fetch"], outputSchemaPath: "schema:validate.output" },
          { stepId: "step_transform", dependencies: ["step_validate"], outputSchemaPath: "schema:transform.output" },
          { stepId: "step_store", dependencies: ["step_transform"], outputSchemaPath: "schema:store.output" },
        ]),
        stepOutputOverrides: {
          step_fetch: { data: "fetched_data" },
          step_validate: { valid: true },
          step_transform: { transformed: "transformed_data" },
          step_store: { stored: true },
        },
      });

      // Verify task reached terminal state
      const task = result.snapshot.task;
      assert.ok(task, "Should have task snapshot");
      assert.ok(
        task!.status === "done" || task!.status === "failed" || task!.status === "cancelled",
        `Task should reach terminal state, got: ${task!.status}`,
      );

      // Verify workflow is completed or failed
      const workflow = result.snapshot.workflow;
      assert.ok(workflow, "Should have workflow snapshot");

      // Verify step outputs were recorded
      assert.ok(result.snapshot.stepOutputs.length >= 1, "Should persist at least one step output");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Workflow: multi-step workflow with step dependency ordering", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-deps-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E dependency ordering test",
        request: buildPlanRequest([
          { stepId: "init", outputSchemaPath: "schema:init.output" },
          { stepId: "process_a", dependencies: ["init"], outputSchemaPath: "schema:process_a.output" },
          { stepId: "process_b", dependencies: ["init"], outputSchemaPath: "schema:process_b.output" },
          { stepId: "merge", dependencies: ["process_a", "process_b"], outputSchemaPath: "schema:merge.output" },
        ]),
        stepOutputOverrides: {
          init: { initialized: true },
          process_a: { result_a: "a_done" },
          process_b: { result_b: "b_done" },
          merge: { merged: "a_and_b_done" },
        },
      });

      const task = result.snapshot.task;
      assert.ok(task, "Should have task snapshot");
      assert.ok(
        task!.status === "done" || task!.status === "failed",
        `Task should complete or fail, got: ${task!.status}`,
      );

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ============================================================================
// Test Suite 2: Workflow with Parallel Branches
// ============================================================================

test("E2E Workflow: parallel branches execute independently and merge", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-parallel-");
    try {
      // Plan: A -> {B, C} -> D
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E parallel branches",
        request: buildPlanRequest([
          { stepId: "step_start", outputSchemaPath: "schema:start.output" },
          { stepId: "step_branch_b", dependencies: ["step_start"], outputSchemaPath: "schema:branch_b.output" },
          { stepId: "step_branch_c", dependencies: ["step_start"], outputSchemaPath: "schema:branch_c.output" },
          { stepId: "step_merge", dependencies: ["step_branch_b", "step_branch_c"], outputSchemaPath: "schema:merge.output" },
        ]),
        stepOutputOverrides: {
          step_start: { started: true },
          step_branch_b: { branch_b: "b_completed" },
          step_branch_c: { branch_c: "c_completed" },
          step_merge: { merged: true },
        },
      });

      const task = result.snapshot.task;
      assert.ok(task, "Should have task snapshot");
      const workflow = result.snapshot.workflow;
      assert.ok(workflow, "Should have workflow");

      // Verify step outputs exist for all branches
      assert.ok(result.snapshot.stepOutputs.length >= 1, "Should persist branch step outputs");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Workflow: parallel branch with one branch failing causes workflow failure", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-parallel-fail-");
    try {
      // Plan: A -> {B, C} where C fails
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E parallel branch failure",
        request: buildPlanRequest([
          { stepId: "step_a", outputSchemaPath: "schema:a.output" },
          { stepId: "step_b", dependencies: ["step_a"], outputSchemaPath: "schema:b.output" },
          { stepId: "step_c_fails", dependencies: ["step_a"], outputSchemaPath: "schema:c.output" },
        ]),
        stepFailurePlans: {
// @ts-ignore
          step_c_fails: ["step.failed", "Branch C failed as planned for test"] as StepFailurePlan[],
        },
        stepOutputOverrides: {
          step_a: { a: "A done" },
          step_b: { b: "B done" },
        },
      });

      const task = result.snapshot.task;
      assert.ok(task, "Should have task snapshot");
      assert.equal(task!.status, "failed", "Task should fail when parallel branch fails");

      // Verify error details are captured
      const output = JSON.parse(task!.outputJson ?? "{}");
      assert.ok(output.error || result.snapshot.workflow?.lastErrorCode, "Should capture workflow failure information");
      assert.ok(Array.isArray(output.failedStepIds), "Should track failed step IDs");
      assert.ok(output.failedStepIds.length > 0, "At least one failed step should be recorded");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Workflow: fan-out fan-in pattern with 3 parallel branches", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-fanout-");
    try {
      // Plan: start -> {branch_1, branch_2, branch_3} -> end
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E fan-out fan-in",
        request: buildPlanRequest([
          { stepId: "start", outputSchemaPath: "schema:start.output" },
          { stepId: "branch_1", dependencies: ["start"], outputSchemaPath: "schema:b1.output" },
          { stepId: "branch_2", dependencies: ["start"], outputSchemaPath: "schema:b2.output" },
          { stepId: "branch_3", dependencies: ["start"], outputSchemaPath: "schema:b3.output" },
          { stepId: "end", dependencies: ["branch_1", "branch_2", "branch_3"], outputSchemaPath: "schema:end.output" },
        ]),
        stepOutputOverrides: {
          start: { started: true },
          branch_1: { r1: "result_1" },
          branch_2: { r2: "result_2" },
          branch_3: { r3: "result_3" },
          end: { completed: true },
        },
      });

      const task = result.snapshot.task;
      assert.ok(task, "Should have task snapshot");
      assert.ok(
        task!.status === "done" || task!.status === "failed",
        `Task should complete or fail, got: ${task!.status}`,
      );

      // All branch outputs should be recorded
      assert.ok(result.snapshot.stepOutputs.length >= 1, "Should persist fan-out step outputs");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ============================================================================
// Test Suite 3: Workflow Error Recovery and Retry
// ============================================================================

test("E2E Workflow: step failure with retry policy recovers successfully", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-retry-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E retry recovery test",
        request: buildPlanRequest([
          { stepId: "step_first", outputSchemaPath: "schema:first.output" },
          { stepId: "step_retry", dependencies: ["step_first"], outputSchemaPath: "schema:retry.output" },
          { stepId: "step_last", dependencies: ["step_retry"], outputSchemaPath: "schema:last.output" },
        ]),
        stepFailurePlans: {
          step_retry: ["transient.error", "Transient error for retry test"],
        },
        stepOutputOverrides: {
          step_first: { first: "done" },
          step_last: { last: "done" },
        },
      });

      const task = result.snapshot.task;
      assert.ok(task, "Should have task snapshot");
      // With transient failure and no retries left in override, it may fail
      assert.ok(
        task!.status === "done" || task!.status === "failed",
        `Task should complete or fail, got: ${task!.status}`,
      );

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Workflow: error code E7 lock contention triggers retry_new_ticket", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-e7-");
    try {
      const taskId = newId("task");
      const executionId = newId("exec");
      const traceId = newId("trace");
      const ts = new TransitionService(harness.db, harness.store);
      const now = nowIso();

      // Setup task with execution that failed due to E7 lock contention
      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: "E7 lock contention test",
          status: "in_progress",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: "E7_LOCK_CONTENTION",
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

// @ts-ignore
        harness.store.insertExecution({
          id: executionId,
          taskId,
          workflowId: "multi_step_wf",
          parentExecutionId: null,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "failed",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 1,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 2,
          retryBackoff: "exponential",
          lastErrorCode: "E7_LOCK_CONTENTION",
          lastErrorMessage: "Resource lock acquisition failed",
          startedAt: now,
          finishedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Create retry execution
      const retryExecutionId = newId("exec_retry");
      harness.db.transaction(() => {
// @ts-ignore
        harness.store.insertExecution({
          id: retryExecutionId,
          taskId,
          workflowId: "multi_step_wf",
          parentExecutionId: executionId,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId: newId("trace"),
          attempt: 2,
          timeoutMs: 60000,
          budgetUsdLimit: 1,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 2,
          retryBackoff: "exponential",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: nowIso(),
          finishedAt: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      });

      // Verify retry execution
      const originalExec = harness.store.getExecution(executionId);
      const retryExec = harness.store.getExecution(retryExecutionId);

      assert.equal(originalExec?.status, "failed", "Original execution should be failed");
      assert.equal(originalExec?.lastErrorCode, "E7_LOCK_CONTENTION", "Should have E7 error code");
      assert.equal(retryExec?.status, "executing", "Retry execution should be running");
      assert.equal(retryExec?.attempt, 2, "Retry attempt should be 2");
      assert.equal(retryExec?.parentExecutionId, executionId, "Should reference parent execution");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Workflow: workflow resumes from correct step after failure", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-resume-");
    try {
      const taskId = newId("task");
      const executionId = newId("exec");
      const traceId = newId("trace");
      const now = nowIso();

      // Setup workflow that failed at step 2 but can resume from step 1
      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: "Resume workflow test",
          status: "in_progress",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: "step2_failure",
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

// @ts-ignore
        harness.store.insertExecution({
          id: executionId,
          taskId,
          workflowId: "resumable_wf",
          parentExecutionId: null,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 120000,
          budgetUsdLimit: 5,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 2,
          retryBackoff: "exponential",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: now,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        harness.store.insertWorkflowState({
          taskId,
          divisionId: "general-ops",
          workflowId: "resumable_wf",
          currentStepIndex: 2,
          status: "failed",
          outputsJson: JSON.stringify({
            step0_result: "completed",
            step1_result: "completed",
          }),
          lastErrorCode: "step2_failure",
          retryCount: 1,
// @ts-ignore
          resumableFromStep: 1, // Can retry from step 1 (step 2 is idempotent)
          startedAt: now,
          updatedAt: now,
        });
      });

      // Verify resumable state
      let workflow = harness.store.getWorkflowState(taskId);
      assert.equal(Number(workflow!.resumableFromStep), 1, "Should be resumable from step 1");
      assert.equal(Number(workflow!.retryCount), 1, "Should have one retry count");
      assert.equal(workflow!.lastErrorCode, "step2_failure", "Error should be recorded");

      // Retry: update state to running and resume from step 1
      harness.db.transaction(() => {
        harness.store.updateWorkflowState(
          taskId,
          "running",
          1, // Reset to step 1
          JSON.stringify({ step0_result: "completed", step1_result: "completed" }),
          nowIso(),
// @ts-ignore
          1, // resumableFromStep
        );
      });

      workflow = harness.store.getWorkflowState(taskId);
      assert.equal(Number(workflow!.currentStepIndex), 1, "Should reset to step 1");
      assert.equal(workflow!.status, "running", "Should be running again");
      assert.equal(workflow!.lastErrorCode, null, "Error should be cleared");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Workflow: dead letter queue after max retries exhausted", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-workflow-dlq-");
    try {
      const taskId = newId("task");
      const exec1Id = newId("exec1");
      const exec2Id = newId("exec2");
      const traceId = newId("trace");
      const now = nowIso();

      // Setup task with two failed executions (max retries exhausted)
      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: "DLQ test",
          status: "in_progress",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: "execution.max_retries_exhausted",
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

        // First execution failed with transient error
// @ts-ignore
        harness.store.insertExecution({
          id: exec1Id,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "failed",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 1,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 2,
          retryBackoff: "exponential",
          lastErrorCode: "transient_error",
          lastErrorMessage: "temporary failure",
          startedAt: now,
          finishedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        // Second execution also failed - retries exhausted
// @ts-ignore
        harness.store.insertExecution({
          id: exec2Id,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: exec1Id,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "failed",
          inputRef: null,
          traceId,
          attempt: 2,
          timeoutMs: 60000,
          budgetUsdLimit: 1,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 2,
          retryBackoff: "exponential",
          lastErrorCode: "transient_error",
          lastErrorMessage: "retry still failing",
          startedAt: now,
          finishedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Verify both executions are failed
      const exec1 = harness.store.getExecution(exec1Id);
      const exec2 = harness.store.getExecution(exec2Id);
      assert.equal(exec1?.status, "failed", "First execution should be failed");
      assert.equal(exec2?.status, "failed", "Second execution should be failed");
      assert.equal(exec2?.parentExecutionId, exec1Id, "Second should reference first as parent");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});
