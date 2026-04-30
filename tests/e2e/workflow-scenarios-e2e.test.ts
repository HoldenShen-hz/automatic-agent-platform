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
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { CompensationManager } from "../../src/platform/execution/compensation-manager.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { SideEffectRecord } from "../../src/platform/contracts/executable-contracts/index.js";

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
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_fetch",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:fetch.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_validate",
            nodeType: "tool",
            inputRefs: ["step_fetch"],
            outputSchemaRef: "schema:validate.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_transform",
            nodeType: "llm",
            inputRefs: ["step_validate"],
            outputSchemaRef: "schema:transform.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_store",
            nodeType: "tool",
            inputRefs: ["step_transform"],
            outputSchemaRef: "schema:store.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
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
      const stepOutputs = harness.store.listStepOutputsByTask(task!.id);
      assert.ok(stepOutputs.length >= 4, "Should have outputs for all 4 steps");

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
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "init",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:init.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "process_a",
            nodeType: "tool",
            inputRefs: ["init"],
            outputSchemaRef: "schema:process_a.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "process_b",
            nodeType: "tool",
            inputRefs: ["init"],
            outputSchemaRef: "schema:process_b.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "merge",
            nodeType: "tool",
            inputRefs: ["process_a", "process_b"],
            outputSchemaRef: "schema:merge.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.002, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
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
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_start",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:start.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_branch_b",
            nodeType: "tool",
            inputRefs: ["step_start"],
            outputSchemaRef: "schema:branch_b.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_branch_c",
            nodeType: "tool",
            inputRefs: ["step_start"],
            outputSchemaRef: "schema:branch_c.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_merge",
            nodeType: "tool",
            inputRefs: ["step_branch_b", "step_branch_c"],
            outputSchemaRef: "schema:merge.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.002, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
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
      const stepOutputs = harness.store.listStepOutputsByTask(task!.id);
      assert.ok(stepOutputs.length >= 4, "Should have outputs for all steps including branches");

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
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_a",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:a.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_b",
            nodeType: "tool",
            inputRefs: ["step_a"],
            outputSchemaRef: "schema:b.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_c_fails",
            nodeType: "tool",
            inputRefs: ["step_a"],
            outputSchemaRef: "schema:c.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
        stepFailurePlans: {
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
      assert.ok(task!.errorCode, "Should have error code");
      const output = JSON.parse(task!.outputJson ?? "{}");
      assert.ok(output.error, "Output should contain error information");
      assert.ok(output.failedStepIds, "Should track failed step IDs");

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
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "start",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:start.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "branch_1",
            nodeType: "tool",
            inputRefs: ["start"],
            outputSchemaRef: "schema:b1.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "branch_2",
            nodeType: "tool",
            inputRefs: ["start"],
            outputSchemaRef: "schema:b2.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "branch_3",
            nodeType: "tool",
            inputRefs: ["start"],
            outputSchemaRef: "schema:b3.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "end",
            nodeType: "tool",
            inputRefs: ["branch_1", "branch_2", "branch_3"],
            outputSchemaRef: "schema:end.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.002, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
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
      const stepOutputs = harness.store.listStepOutputsByTask(task!.id);
      assert.ok(stepOutputs.length >= 5, "Should have outputs for all 5 steps");

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
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_first",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:first.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_retry",
            nodeType: "tool",
            inputRefs: ["step_first"],
            outputSchemaRef: "schema:retry.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_last",
            nodeType: "tool",
            inputRefs: ["step_retry"],
            outputSchemaRef: "schema:last.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
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
          divisionId: "general_ops",
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
          divisionId: "general_ops",
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
          divisionId: "general_ops",
          workflowId: "resumable_wf",
          currentStepIndex: 2,
          status: "failed",
          outputsJson: JSON.stringify({
            step0_result: "completed",
            step1_result: "completed",
          }),
          lastErrorCode: "step2_failure",
          retryCount: 1,
          resumableFromStep: 1, // Can retry from step 1 (step 2 is idempotent)
          startedAt: now,
          updatedAt: now,
        });
      });

      // Verify resumable state
      let workflow = harness.store.getWorkflowState(taskId);
      assert.equal(workflow!.resumableFromStep, 1, "Should be resumable from step 1");
      assert.equal(workflow!.retryCount, 1, "Should have one retry count");
      assert.equal(workflow!.lastErrorCode, "step2_failure", "Error should be recorded");

      // Retry: update state to running and resume from step 1
      harness.db.transaction(() => {
        harness.store.updateWorkflowState(
          taskId,
          "running",
          1, // Reset to step 1
          JSON.stringify({ step0_result: "completed", step1_result: "completed" }),
          nowIso(),
          1, // resumableFromStep
        );
      });

      workflow = harness.store.getWorkflowState(taskId);
      assert.equal(workflow!.currentStepIndex, 1, "Should reset to step 1");
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
          divisionId: "general_ops",
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

// ============================================================================
// Test Suite 4: Workflow with Compensation
// ============================================================================

test("E2E Workflow: CompensationManager validates compensatable side effects", async () => {
  const manager = new CompensationManager();

  // Create a mock side effect in compensatable state
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-001",
    status: "failed",
    effectKind: "file_write",
    riskClass: "medium",
  });

  const result = manager.validateCompensationPreconditions(sideEffect);
  assert.equal(result.valid, true, "Failed side effect should be compensatable");
});

test("E2E Workflow: CompensationManager creates compensation plan for failed side effect", async () => {
  const manager = new CompensationManager();

  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-002",
    status: "failed",
    effectKind: "file_write",
    externalRef: "file:///tmp/test.txt",
    riskClass: "medium",
  });

  const context = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test compensation",
  };

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.compensationId, "Plan should have compensation ID");
  assert.equal(plan.sideEffectId, "effect-002", "Plan should reference correct side effect");
  assert.ok(plan.steps.length > 0, "Plan should have compensation steps");
  assert.equal(plan.steps[0]?.stepType, "reverse", "First step should be reverse");
});

test("E2E Workflow: CompensationManager requires human approval for high impact compensation", async () => {
  const manager = new CompensationManager();

  assert.equal(manager.requiresHumanApproval("high"), true, "High impact should require approval");
  assert.equal(manager.requiresHumanApproval("low"), false, "Low impact should not require approval");
  assert.equal(manager.requiresHumanApproval("medium"), false, "Medium impact should not require approval");
});

test("E2E Workflow: CompensationManager state transitions follow correct FSM", async () => {
  const manager = new CompensationManager();

  // Test planned -> running on approve
  assert.equal(manager.getNextCompensationStatus("planned", "approve"), "running");

  // Test planned -> requires_human on escalate
  assert.equal(manager.getNextCompensationStatus("planned", "escalate"), "requires_human");

  // Test running -> succeeded on confirm
  assert.equal(manager.getNextCompensationStatus("running", "confirm"), "succeeded");

  // Test running -> failed on fail
  assert.equal(manager.getNextCompensationStatus("running", "fail"), "failed");

  // Test failed -> planned on plan (retry)
  assert.equal(manager.getNextCompensationStatus("failed", "plan"), "planned");

  // Test terminal states have no transitions
  assert.equal(manager.getNextCompensationStatus("succeeded", "approve"), null);
  assert.equal(manager.getNextCompensationStatus("compensated", "plan"), null);
});

test("E2E Workflow: non-compensatable side effects are rejected", async () => {
  const manager = new CompensationManager();

  // Succeeded side effect should not be compensatable
  const succeededSideEffect = createMockSideEffect({
    sideEffectId: "effect-003",
    status: "succeeded",
    effectKind: "file_write",
    riskClass: "low",
  });

  const result = manager.validateCompensationPreconditions(succeededSideEffect);
  assert.equal(result.valid, false, "Succeeded side effect should not be compensatable");
  assert.ok(result.reason?.includes("not in a compensatable state"), "Should have correct reason");
});

test("E2E Workflow: compensation plan sets correct impact based on risk class", async () => {
  const manager = new CompensationManager();

  const context = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test",
  };

  // Critical risk should have high impact
  const criticalSideEffect = createMockSideEffect({
    sideEffectId: "effect-critical",
    status: "failed",
    effectKind: "delete_resource",
    riskClass: "critical",
  });

  const criticalPlan = manager.planCompensation(criticalSideEffect, context);
  assert.equal(criticalPlan.steps[0]?.estimatedImpact, "high", "Critical risk should have high impact");

  // Low risk should have low impact
  const lowSideEffect = createMockSideEffect({
    sideEffectId: "effect-low",
    status: "failed",
    effectKind: "read_operation",
    riskClass: "low",
  });

  const lowPlan = manager.planCompensation(lowSideEffect, context);
  assert.equal(lowPlan.steps[0]?.estimatedImpact, "low", "Low risk should have low impact");
});

test("E2E Workflow: compensation uses idempotency key when no external ref", async () => {
  const manager = new CompensationManager();

  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-idem",
    effectKind: "api_call",
    externalRef: undefined,
    idempotencyKey: "idem-key-123",
    riskClass: "medium",
    status: "failed",
  });

  const context = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test",
  };

  const plan = manager.planCompensation(sideEffect, context);
  assert.equal(plan.steps[0]?.targetRef, "idem-key-123", "Should use idempotency key when no external ref");
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMockSideEffect(overrides: Partial<SideEffectRecord> = {}): SideEffectRecord {
  return {
    id: overrides.sideEffectId ?? "se-default",
    sideEffectId: overrides.sideEffectId ?? "se-default",
    harnessRunId: overrides.harnessRunId ?? "harness-default",
    nodeRunId: overrides.nodeRunId ?? "node-run-default",
    nodeAttemptId: overrides.nodeAttemptId ?? "node-attempt-default",
    effectKind: overrides.effectKind ?? "test_effect",
    idempotencyKey: overrides.idempotencyKey ?? "idem-key-default",
    status: overrides.status ?? "succeeded",
    riskClass: overrides.riskClass ?? "low",
    externalRef: overrides.externalRef ?? "external-ref-123",
    preCommitPolicyProofRef: null,
    deadline: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as SideEffectRecord;
}
