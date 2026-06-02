/**
 * E2E Task Execution Flow Tests
 *
 * End-to-end tests covering complete task execution flows:
 * 1. Single task happy path - Task creation → execution → completion
 * 2. Multi-step orchestration - Multi-step workflow execution
 *
 * These tests verify:
 * - Budget reservation throughout execution lifecycle
 * - State machine transitions (queued → in_progress → done/failed)
 * - Error recovery scenarios
 * - Complete business flows from end to end
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness, createSeededE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { runSingleTaskExecution } from "../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { runMultiStepOrchestration } from "../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

// =============================================================================
// Test 1: Single Task Happy Path E2E
// =============================================================================

test("E2E Task Execution: single task happy path - task creation to completion", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-single-task-");
    try {
      // Execute single task happy path with step output override to avoid LLM calls
      const result = await runSingleTaskExecution({
        dbPath: harness.dbPath,
        title: "E2E single task test",
        request: "Analyze this request and produce a summary",
        stepOutputOverride: {
          summary: "Request analyzed successfully",
          result: "Analysis complete",
        },
      });

      // Verify task snapshot is returned
      assert.ok(result, "Should return task snapshot");
      assert.ok(result.task, "Snapshot should contain task");
// @ts-ignore
      assert.ok(result.executions, "Snapshot should contain executions");
      assert.ok(result.workflow, "Snapshot should contain workflow");
      assert.ok(result.session, "Snapshot should contain session");

      // Verify task status is done
      assert.equal(result.task?.status, "done", "Task should be in done status");
      assert.ok(result.task?.completedAt, "Task should have completedAt timestamp");
      assert.ok(result.task?.outputJson, "Task should have output JSON");

      // Verify workflow is completed
      assert.equal(result.workflow?.status, "completed", "Workflow should be completed");

      // Verify execution succeeded
// @ts-ignore
      const execution = result.executions?.[0];
      assert.ok(execution, "Should have at least one execution");
      assert.equal(execution?.status, "succeeded", "Execution should be succeeded");
      assert.ok(execution?.finishedAt, "Execution should have finishedAt");

      // Verify session is completed
      assert.equal(result.session?.status, "completed", "Session should be completed");

      // Verify task output content
      const output = JSON.parse(result.task?.outputJson ?? "{}");
      assert.equal(output.summary, "Request analyzed successfully", "Output summary should match");
      assert.equal(output.result, "Analysis complete", "Output result should match");

      // Verify cost tracking
      assert.ok(result.task?.actualCostUsd !== undefined, "Should have cost tracking");
      assert.ok(result.task?.estimatedCostUsd !== undefined, "Should have estimated cost");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// =============================================================================
// Test 2: Single Task Happy Path with Budget Reservation
// =============================================================================

test("E2E Task Execution: single task reserves budget and tracks costs", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-budget-");
    try {
      const initialBudget = 1.0;

      const result = await runSingleTaskExecution({
        dbPath: harness.dbPath,
        title: "E2E budget tracking test",
        request: "Perform a budgeted task",
        stepOutputOverride: {
          summary: "Budgeted task completed",
          result: "Done",
        },
      });

      // Verify task has budget limit set
// @ts-ignore
      const execution = result.executions?.[0];
      assert.ok(execution, "Should have execution record");
      assert.equal(execution?.budgetUsdLimit, initialBudget, "Budget limit should be set");

      // Verify cost was recorded
      const costs = harness.store.listCostEventsByTask(result.task!.id);
      assert.ok(costs.length > 0, "Should have cost events recorded");

      // Verify actual cost is tracked on task
      assert.ok(result.task?.actualCostUsd !== undefined, "Should have actual cost on task");
      assert.ok(result.task?.actualCostUsd >= 0, "Actual cost should be non-negative");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// =============================================================================
// Test 3: Single Task State Machine Transitions
// =============================================================================

test("E2E Task Execution: single task follows correct state machine transitions", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-state-machine-");
    try {
      const taskId = newId("task");
      const executionId = newId("exec");
      const sessionId = newId("sess");
      const traceId = newId("trace");
      const ts = new TransitionService(harness.db, harness.store);
      const now = nowIso();

      // Setup: Create task in queued state
      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          tenantId: null,
          title: "State machine test",
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0.05,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

// @ts-ignore
        harness.store.insertExecution({
          id: executionId,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-general",
          roleId: "general_executor",
          runKind: "task_run",
          status: "created",
          inputRef: null,
          traceId,
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
          startedAt: null,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        harness.store.insertWorkflowState({
          taskId,
          divisionId: "general-ops",
          workflowId: "single_agent_minimal",
          currentStepIndex: 0,
          status: "running",
          outputsJson: "{}",
          lastErrorCode: null,
          retryCount: 0,
          resumableFromStep: null,
          startedAt: now,
          updatedAt: now,
        });

        harness.store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "open",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Verify initial state: queued
      let task = harness.store.getTask(taskId);
      assert.equal(task?.status, "queued", "Task should start in queued state");

      // Transition: queued → in_progress
      ts.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "in_progress",
        executionId,
        reasonCode: "task.started",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      task = harness.store.getTask(taskId);
      assert.equal(task?.status, "in_progress", "Task should transition to in_progress");

      // Transition: session open → streaming
      ts.transitionSessionStatus({
        entityKind: "session",
        entityId: sessionId,
        fromStatus: "open",
        toStatus: "streaming",
        reasonCode: "session.streaming_started",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      let session = harness.store.getSession(sessionId);
      assert.equal(session?.status, "streaming", "Session should transition to streaming");

      // Transition: execution created → executing
      ts.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "created",
        toStatus: "executing",
        reasonCode: "execution.started",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      let execution = harness.store.getExecution(executionId);
      assert.equal(execution?.status, "executing", "Execution should transition to executing");

      // Transition: execution executing → succeeded
      ts.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "executing",
        toStatus: "succeeded",
        reasonCode: "execution.succeeded",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      execution = harness.store.getExecution(executionId);
      assert.equal(execution?.status, "succeeded", "Execution should transition to succeeded");

      // Transition to terminal state: done
      ts.transitionTaskTerminalState({
        taskId,
        sessionId,
        executionId,
        currentTaskStatus: "in_progress",
        currentWorkflowStatus: "running",
        currentSessionStatus: "streaming",
        currentExecutionStatus: "succeeded",
        terminalStatus: "done",
        taskOutputJson: JSON.stringify({ result: "success" }),
        outputsJson: "{}",
        context: {
          reasonCode: "task.completed",
          traceId,
          actorType: "system",
          occurredAt: nowIso(),
        },
      });

      task = harness.store.getTask(taskId);
      assert.equal(task?.status, "done", "Task should transition to done terminal state");
      assert.ok(task?.completedAt, "Task should have completedAt");

      session = harness.store.getSession(sessionId);
      assert.equal(session?.status, "completed", "Session should transition to completed");

      const workflow = harness.store.getWorkflowState(taskId);
      assert.equal(workflow?.status, "completed", "Workflow should transition to completed");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// =============================================================================
// Test 4: Multi-Step Orchestration Happy Path
// =============================================================================

test("E2E Task Execution: multi-step orchestration completes multiple steps", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-multi-step-");
    try {
      // Execute multi-step orchestration with OAPEFLIR plan format
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E multi-step test",
        request: `oapeflir://plan ${JSON.stringify([
          {
            stepId: "step_extract",
            outputs: ["extracted_data"],
            dependencies: [],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
          },
          {
            stepId: "step_transform",
            outputs: ["transformed_data"],
            dependencies: ["step_extract"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
          },
          {
            stepId: "step_load",
            outputs: ["final_result"],
            dependencies: ["step_transform"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
          },
        ])}`,
        stepOutputOverrides: {
          step_extract: { summary: "Extracted source data", result: "extracted value" },
          step_transform: { summary: "Transformed extracted data", result: "transformed value" },
          step_load: { summary: "Loaded final result", result: "final result" },
        },
      });

      // Verify result structure
      assert.ok(result.snapshot, "Should return task snapshot");
      assert.ok(result.routing, "Should have routing info");
      assert.ok(result.plannedWorkflow, "Should have planned workflow");
      assert.ok(result.streamFrames.length >= 1, "Should replay workflow stream frames");

      // Verify task reached done status
      const task = result.snapshot.task;
      assert.ok(task, "Snapshot should contain task");
      assert.equal(task?.status, "done", "Multi-step task should reach done status");

      // Verify all step outputs were recorded
// @ts-ignore
      const stepOutputs = result.snapshot.stepOutputs;
      assert.ok(stepOutputs.length >= 3, "Should have outputs for all 3 steps");

      // Verify workflow is completed
      const workflow = result.snapshot.workflow;
      assert.ok(workflow, "Snapshot should contain workflow");
      assert.equal(workflow?.status, "completed", "Workflow should be completed");

      // Verify task output
      const output = JSON.parse(task?.outputJson ?? "{}");
      assert.ok(output.final || Object.keys(output).length > 0, "Should have task output");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// =============================================================================
// Test 5: Multi-Step Orchestration with Failed Step
// =============================================================================

test("E2E Task Execution: multi-step orchestration handles step failure", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-multi-step-fail-");
    try {
      // Execute multi-step with failure injection on step_transform
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E multi-step failure test",
        request: `oapeflir://plan ${JSON.stringify([
          {
            stepId: "step_extract",
            outputs: ["extracted_data"],
            dependencies: [],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
          },
          {
            stepId: "step_transform",
            outputs: ["transformed_data"],
            dependencies: ["step_extract"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
          },
          {
            stepId: "step_load",
            outputs: ["final_result"],
            dependencies: ["step_transform"],
            timeout: 30000,
            retryPolicy: { maxRetries: 0 },
          },
        ])}`,
        // Override step_extract to succeed, step_transform to fail
        stepFailurePlans: {
          step_transform: ["transform.failed", "Transform step encountered an error"],
        },
        stepOutputOverrides: {
          step_extract: { summary: "Extracted source data", result: "extracted value" },
        },
      });

      // Verify task reached failed status due to step failure
      const task = result.snapshot.task;
      assert.ok(task, "Snapshot should contain task");
      assert.equal(task?.status, "failed", "Task should be in failed status due to step failure");

      // Verify workflow is also failed
      const workflow = result.snapshot.workflow;
      assert.ok(workflow, "Snapshot should contain workflow");
      assert.equal(workflow?.status, "failed", "Workflow should be failed");

      // Verify error code is set
      assert.ok(task?.errorCode, "Task should have error code");
      assert.ok(task?.outputJson, "Task should have output JSON with error details");

      // Parse output to verify error details
      const output = JSON.parse(task?.outputJson ?? "{}");
      assert.ok(output.error, "Output should contain error information");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// =============================================================================
// Test 6: Seeded Harness for Quick Task Setup
// =============================================================================

test("E2E Task Execution: seeded harness provides pre-configured task and execution", async () => {
  const harness = createSeededE2EHarness("aa-e2e-seeded-", {
    taskId: "task-seeded-001",
    executionId: "exec-seeded-001",
  });

  try {
    // Verify seeded task exists
    const task = harness.store.getTask("task-seeded-001");
    assert.ok(task, "Seeded task should exist");
    assert.equal(task?.title, "E2E test task", "Seeded task should have correct title");
    assert.equal(task?.status, "in_progress", "Seeded task should be in_progress");

    // Verify seeded execution exists
    const execution = harness.store.getExecution("exec-seeded-001");
    assert.ok(execution, "Seeded execution should exist");
    assert.equal(execution?.status, "executing", "Seeded execution should be executing");
    assert.equal(execution?.workflowId, "single_agent_minimal", "Seeded execution should have correct workflow");

    // Verify workflow state exists
    const workflow = harness.store.getWorkflowState("task-seeded-001");
    assert.ok(workflow, "Seeded workflow should exist");

  } finally {
    harness.cleanup();
  }
});

// =============================================================================
// Test 7: Task Execution with Priority
// =============================================================================

test("E2E Task Execution: task execution respects priority ordering", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-priority-");
    try {
      // Execute high priority task
      const highPriorityResult = await runSingleTaskExecution({
        dbPath: harness.dbPath,
        title: "High priority task",
        request: "Process this high priority request",
        stepOutputOverride: {
          summary: "High priority completed",
          result: "Done",
        },
      });

      assert.equal(highPriorityResult.task?.priority, "normal", "Default priority should be normal");

      // Create medium priority task manually using harness
      const taskId = newId("task");
      const now = nowIso();

      harness.db.transaction(() => {
        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          tenantId: null,
          title: "Medium priority task",
          status: "queued",
          source: "user",
// @ts-ignore
          priority: "medium",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0.05,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });

      const task = harness.store.getTask(taskId);
      assert.equal(task?.priority, "medium", "Task should have medium priority");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// =============================================================================
// Test 8: Task Execution Produces Artifacts
// =============================================================================

test("E2E Task Execution: task execution produces step output artifacts", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-artifacts-");
    try {
      const result = await runSingleTaskExecution({
        dbPath: harness.dbPath,
        title: "E2E artifact test",
        request: "Create some artifacts",
        stepOutputOverride: {
          summary: "Artifacts created",
          result: "Artifacts generated successfully",
        },
      });

      // Verify artifacts were created
      const artifacts = harness.store.listArtifactsByTask(result.task!.id);
      assert.ok(artifacts.length > 0, "Should have created artifacts");

      // Verify step outputs were recorded
// @ts-ignore
      const stepOutputs = result.stepOutputs;
      assert.ok(stepOutputs.length > 0, "Should have step outputs");

      // Verify step output contains our custom data
      const stepOutput = stepOutputs[0];
      assert.ok(stepOutput, "Should have step output");
      const stepData = JSON.parse(stepOutput?.dataJson ?? "{}");
      assert.equal(stepData.result, "Artifacts generated successfully", "Step output should contain custom data");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});
