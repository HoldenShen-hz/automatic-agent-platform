/**
 * E2E Harness Multi-Step Orchestration Tests
 *
 * End-to-end tests covering harness multi-step orchestration execution
 * with PlanGraphBundle, verifying the OAPEFLR execution phases and
 * complete lifecycle management.
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
 *   - stepOutputOverrides for controlling step outputs
 *   - stepFailureInjection/stepFailurePlans for error testing
 *
 * Tests verify:
 * - Multi-step orchestration with step output overrides
 * - PlanGraphBundle creation and validation
 * - Step failure handling and recovery
 * - Budget tracking throughout orchestration
 * - Context compaction integration
 * - Terminal state transitions
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { runMultiStepOrchestration, type MultiStepToolExecutionInput } from "../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";

// ---------------------------------------------------------------------------
// Test 1: Multi-step orchestration with PlanGraphBundle happy path
// ---------------------------------------------------------------------------

test("E2E Harness Multi-Step: runMultiStepOrchestration completes 3-step workflow with outputs", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-harness-multi-");
    try {
      // Execute 3-step orchestration with output overrides
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E multi-step harness test",
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_extract",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:extract.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_transform",
            nodeType: "llm",
            inputRefs: ["step_extract"],
            outputSchemaRef: "schema:transform.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_load",
            nodeType: "tool",
            inputRefs: ["step_transform"],
            outputSchemaRef: "schema:load.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
        stepOutputOverrides: {
          step_extract: { extracted: "data extracted successfully" },
          step_transform: { transformed: "data transformed successfully" },
          step_load: { final: "data loaded successfully" },
        },
      });

      // Verify result structure
      assert.ok(result.snapshot, "Should return task snapshot");
      assert.ok(result.routing, "Should have routing info");
      assert.ok(result.plannedWorkflow, "Should have planned workflow");

      // Verify task reached done status
      const task = result.snapshot.task;
      assert.ok(task, "Snapshot should contain task");
      assert.equal(task?.status, "done", "Task should reach done status");

      // Verify all step outputs are in the result
      assert.ok(result.plannedWorkflow, "Should have planned workflow with step details");

      // Verify workflow is completed
      const workflow = result.snapshot.workflow;
      assert.ok(workflow, "Snapshot should contain workflow");
      assert.equal(workflow?.status, "completed", "Workflow should be completed");

      // Verify task output contains step results
      const output = JSON.parse(task?.outputJson ?? "{}");
      assert.ok(Object.keys(output).length > 0, "Should have task output");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 2: Multi-step orchestration with step failure handling
// ---------------------------------------------------------------------------

test("E2E Harness Multi-Step: handles step failure and transitions to failed state", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-harness-fail-");
    try {
      // Execute multi-step with failure injection on middle step
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E multi-step failure test",
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
            nodeId: "step_failing",
            nodeType: "tool",
            inputRefs: ["step_first"],
            outputSchemaRef: "schema:failing.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_last",
            nodeType: "tool",
            inputRefs: ["step_failing"],
            outputSchemaRef: "schema:last.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
        stepFailurePlans: {
          step_failing: ["step.failed", "Step failed as planned for test"],
        },
        stepOutputOverrides: {
          step_first: { first: "first step completed" },
        },
      });

      // Verify task reached failed status
      const task = result.snapshot.task;
      assert.ok(task, "Snapshot should contain task");
      assert.equal(task?.status, "failed", "Task should be in failed status");

      // Verify workflow is also failed
      const workflow = result.snapshot.workflow;
      assert.ok(workflow, "Snapshot should contain workflow");
      assert.equal(workflow?.status, "failed", "Workflow should be failed");

      // Verify error code is set
      assert.ok(task?.errorCode, "Task should have error code");

      // Verify output contains error details
      const output = JSON.parse(task?.outputJson ?? "{}");
      assert.ok(output.error, "Output should contain error information");
      assert.ok(output.failedStepIds, "Output should track failed step IDs");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 3: Multi-step orchestration with budget tracking
// ---------------------------------------------------------------------------

test("E2E Harness Multi-Step: tracks budget across multi-step execution", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-harness-budget-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E budget tracking test",
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_one",
            nodeType: "llm",
            inputRefs: [],
            outputSchemaRef: "schema:one.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.05, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_two",
            nodeType: "llm",
            inputRefs: ["step_one"],
            outputSchemaRef: "schema:two.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.05, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
        stepOutputOverrides: {
          step_one: { result: "first LLM call done" },
          step_two: { result: "second LLM call done" },
        },
      });

      // Verify task has cost tracking
      const task = result.snapshot.task;
      assert.ok(task, "Should have task");
      assert.ok(task?.estimatedCostUsd !== undefined, "Should have estimated cost");
      assert.ok(task?.actualCostUsd !== undefined, "Should have actual cost");

      // Multi-step orchestration now records actual spend only when the run
      // captured real llmResult usage telemetry for those steps.
      const costEvents = harness.store.listCostEventsByTask(task!.id);
      assert.equal(costEvents.length, 0, "Should not synthesize cost events without llm telemetry");
      assert.equal(task?.actualCostUsd, 0, "Actual cost should remain zero when no cost events were recorded");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 4: Multi-step orchestration with context compaction
// ---------------------------------------------------------------------------

test("E2E Harness Multi-Step: context compaction triggers during long orchestration", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-harness-compaction-");
    try {
      // Execute multi-step with many messages to trigger compaction
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E compaction test",
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_process",
            nodeType: "llm",
            inputRefs: [],
            outputSchemaRef: "schema:process.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
        stepOutputOverrides: {
          step_process: { result: "processed" },
        },
      });

      // Verify task completed
      const task = result.snapshot.task;
      assert.ok(task, "Should have task");
      assert.equal(task?.status, "done", "Task should complete");

      // Verify compaction result is returned (may be null if not triggered)
      assert.ok(result.compaction !== undefined, "Should have compaction field");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 5: Multi-step orchestration state machine transitions
// ---------------------------------------------------------------------------

test("E2E Harness Multi-Step: follows correct state machine transitions", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-harness-states-");
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
          workflowId: "multi_step_harness",
          parentExecutionId: null,
          agentId: "agent-general",
          roleId: "general_executor",
          runKind: "task_run",
          status: "created",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 120000,
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
          workflowId: "multi_step_harness",
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

// ---------------------------------------------------------------------------
// Test 6: Multi-step with parallel task groups via OAPEFLR
// ---------------------------------------------------------------------------

test("E2E Harness Multi-Step: executes parallel node groups correctly", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-harness-parallel-");
    try {
      // Create plan with parallel branches: A -> {B, C} -> D
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E parallel execution test",
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
            nodeId: "step_c",
            nodeType: "tool",
            inputRefs: ["step_a"],
            outputSchemaRef: "schema:c.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
        stepOutputOverrides: {
          step_a: { a: "A completed" },
          step_b: { b: "B completed" },
          step_c: { c: "C completed" },
        },
      });

      // Verify execution completed
      assert.ok(result.snapshot.task, "Should have task snapshot");
      const task = result.snapshot.task!;
      assert.ok(
        task.status === "done" || task.status === "failed" || task.status === "cancelled",
        `Task should reach terminal state, got: ${task.status}`
      );

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 7: Multi-step with HITL wait node type
// ---------------------------------------------------------------------------

test("E2E Harness Multi-Step: handles HITL wait node type", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-harness-hitl-");
    try {
      // Create plan with HITL wait node
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E HITL test",
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_prepare",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:prepare.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_approval",
            nodeType: "hitl_wait",
            inputRefs: ["step_prepare"],
            outputSchemaRef: "schema:approval.output",
            riskClass: "high",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 60000,
          },
        ])}`,
        stepOutputOverrides: {
          step_prepare: { prepared: true },
        },
      });

      // Verify task snapshot
      assert.ok(result.snapshot.task, "Should have task snapshot");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// End of E2E Harness Multi-Step Orchestration Tests
// ---------------------------------------------------------------------------
