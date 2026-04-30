/**
 * E2E Full Orchestration Loop Tests
 *
 * End-to-end tests covering complete orchestration loop:
 * 1. Plan → Execute → Observe → Feedback (full loop)
 * 2. Multi-step orchestration with feedback integration
 * 3. Plan graph execution with parallel branches
 * 4. Observe feedback with error recovery
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 * Pattern: createE2EHarness for full stack context.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus, WorkflowStatus } from "../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// Test 1: Full orchestration loop - plan → execute → observe → feedback
// ---------------------------------------------------------------------------

test("E2E Orchestration Loop: plan → execute → observe → feedback completes workflow", async () => {
  const harness = createE2EHarness("aa-e2e-orch-loop-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // PHASE 1: PLAN - Create task with multi-step workflow
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Full orchestration loop test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "multi-step workflow with feedback" }),
        normalizedInputJson: JSON.stringify({ request: "multi-step workflow with feedback" }),
        outputJson: null,
        estimatedCostUsd: 0.1,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "multi_step_wf",
        parentExecutionId: null,
        agentId: "agent-orch",
        roleId: "coordinator",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 2,
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

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_wf",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Verify plan phase
    let workflow = harness.store.getWorkflowState(taskId);
    assert.ok(workflow, "Workflow should exist after planning");
    assert.equal(workflow!.currentStepIndex, 0, "Should start at step 0");
    assert.equal(workflow!.status, "running", "Workflow should be running");

    // PHASE 2: EXECUTE - Execute step 0
    harness.db.transaction(() => {
      harness.store.workflow.insertStepOutput({
        id: newId("step"),
        taskId,
        stepId: "intake_triage",
        roleId: "coordinator",
        status: "succeeded",
        dataJson: JSON.stringify({
          intent: "analyze_and_transform",
          priority: "normal",
        }),
        summary: "Intake triage completed",
        artifactsJson: "[]",
        tokenCost: 50,
        durationMs: 500,
        validationJson: JSON.stringify({ valid: true }),
        producedAt: now,
      });
    });

    // Advance to step 1
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ intake_triage: { intent: "analyze_and_transform" } }),
        now,
        null,
      );
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow!.currentStepIndex, 1, "Should advance to step 1");

    // PHASE 3: EXECUTE - Execute step 1
    harness.db.transaction(() => {
      harness.store.workflow.insertStepOutput({
        id: newId("step"),
        taskId,
        stepId: "analysis",
        roleId: "general_executor",
        status: "succeeded",
        dataJson: JSON.stringify({
          analysis: "data analyzed",
          result: { key: "value" },
        }),
        summary: "Analysis step completed",
        artifactsJson: "[]",
        tokenCost: 100,
        durationMs: 1000,
        validationJson: JSON.stringify({ valid: true }),
        producedAt: now,
      });
    });

    // Advance to step 2
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "running",
        2,
        JSON.stringify({
          intake_triage: { intent: "analyze_and_transform" },
          analysis: { analysis: "data analyzed" },
        }),
        now,
        null,
      );
    });

    // PHASE 4: OBSERVE - Record observation events
    harness.db.transaction(() => {
      harness.store.event.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: "workflow:step_completed",
        eventTier: "tier_1" as const,
        payloadJson: JSON.stringify({
          stepIndex: 2,
          stepId: "analysis",
          status: "succeeded",
        }),
        traceId,
        createdAt: now,
      });
    });

    // Verify events were recorded
    const events = harness.store.event.listEventsForTask(taskId);
    assert.ok(events.length >= 1, "Should have recorded workflow events");
    const stepEvent = events.find(e => e.eventType === "workflow:step_completed");
    assert.ok(stepEvent, "Should have step completed event");

    // PHASE 5: FEEDBACK - Process feedback and complete workflow
    harness.db.transaction(() => {
      harness.store.workflow.insertStepOutput({
        id: newId("step"),
        taskId,
        stepId: "transform",
        roleId: "general_executor",
        status: "succeeded",
        dataJson: JSON.stringify({
          transformed: true,
          output: "final result",
        }),
        summary: "Transform step completed",
        artifactsJson: "[]",
        tokenCost: 75,
        durationMs: 750,
        validationJson: JSON.stringify({ valid: true }),
        producedAt: now,
      });
    });

    // Complete workflow
    ts.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "completed",
      currentStepIndex: 3,
      outputsJson: JSON.stringify({
        intake_triage: { intent: "analyze_and_transform" },
        analysis: { analysis: "data analyzed" },
        transform: { transformed: true, output: "final result" },
        final: true,
      }),
      reasonCode: "workflow.completed",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");

    // Task completes
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "done",
      executionId,
      reasonCode: "task.completed",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");
    assert.ok(task?.completedAt, "Task should have completedAt");
    // Note: outputJson is not set in this test since we're using direct store updates
    // In a real integration, the workflow output would be written to task.outputJson

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Plan graph with parallel branches
// ---------------------------------------------------------------------------

test("E2E Orchestration Loop: parallel branches merge and continue", async () => {
  const harness = createE2EHarness("aa-e2e-parallel-merge-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup workflow with parallel branches
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Parallel merge test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "parallel workflow" }),
        normalizedInputJson: JSON.stringify({ request: "parallel workflow" }),
        outputJson: null,
        estimatedCostUsd: 0.1,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "parallel_wf",
        parentExecutionId: null,
        agentId: "agent-parallel",
        roleId: "coordinator",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 2,
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

      // Workflow at merge step (step 2) with outputs from parallel branches
      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "parallel_wf",
        currentStepIndex: 2,
        status: "running",
        outputsJson: JSON.stringify({
          branch_a: { result: "A output" },
          branch_b: { result: "B output" },
        }),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Verify parallel outputs are accumulated
    const workflow = harness.store.getWorkflowState(taskId);
    assert.ok(workflow, "Workflow should exist");
    const outputs = JSON.parse(workflow!.outputsJson);
    assert.ok(outputs.branch_a, "Branch A output should exist");
    assert.ok(outputs.branch_b, "Branch B output should exist");

    // Execute merge step
    harness.db.transaction(() => {
      harness.store.workflow.insertStepOutput({
        id: newId("step"),
        taskId,
        stepId: "merge",
        roleId: "coordinator",
        status: "succeeded",
        dataJson: JSON.stringify({
          merged: "A and B combined",
          combined: { a: outputs.branch_a, b: outputs.branch_b },
        }),
        summary: "Merge step completed",
        artifactsJson: "[]",
        tokenCost: 25,
        durationMs: 250,
        validationJson: JSON.stringify({ valid: true }),
        producedAt: now,
      });
    });

    // Complete workflow
    ts.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: taskId,
      fromStatus: "running",
      toStatus: "completed",
      currentStepIndex: 3,
      outputsJson: JSON.stringify({
        branch_a: { result: "A output" },
        branch_b: { result: "B output" },
        merge: { merged: "A and B combined" },
      }),
      reasonCode: "workflow.completed",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const finalWorkflow = harness.store.getWorkflowState(taskId);
    assert.equal(finalWorkflow?.status, "completed", "Workflow should be completed");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Observe feedback with error recovery
// ---------------------------------------------------------------------------

test("E2E Orchestration Loop: observe detects error and triggers recovery", async () => {
  const harness = createE2EHarness("aa-e2e-observe-recovery-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);
    const now = nowIso();

    // Setup workflow in error state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Error recovery test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "recovery workflow" }),
        normalizedInputJson: JSON.stringify({ request: "recovery workflow" }),
        outputJson: null,
        estimatedCostUsd: 0.1,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "recovery_wf",
        parentExecutionId: null,
        agentId: "agent-recovery",
        roleId: "coordinator",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 120000,
        budgetUsdLimit: 2,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
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
        workflowId: "recovery_wf",
        currentStepIndex: 1,
        status: "running",
        outputsJson: JSON.stringify({
          step_0: { status: "completed" },
        }),
        lastErrorCode: "E7_DEADLOCK",
        retryCount: 1,
        resumableFromStep: "step_0",
        startedAt: now,
        updatedAt: now,
      });
    });

    // Verify error state
    let workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.lastErrorCode, "E7_DEADLOCK", "Should have deadlock error");
    assert.equal(workflow?.retryCount, 1, "Should have 1 retry count");
    assert.equal(workflow?.resumableFromStep, "step_0", "Should be resumable from step_0");

    // Record recovery event via observe
    harness.db.transaction(() => {
      harness.store.event.insertEvent({
        id: newId("evt"),
        taskId,
        executionId,
        eventType: "recovery:initiated",
        eventTier: "tier_1" as const,
        payloadJson: JSON.stringify({
          errorCode: "E7_DEADLOCK",
          retryCount: 1,
          recoveryAction: "retry_from_checkpoint",
          resumableFromStep: "step_0",
        }),
        traceId,
        createdAt: now,
      });
    });

    // Verify recovery event
    const events = harness.store.event.listEventsForTask(taskId);
    const recoveryEvent = events.find(e => e.eventType === "recovery:initiated");
    assert.ok(recoveryEvent, "Should have recovery initiated event");

    // Rollback workflow state for retry
    harness.db.transaction(() => {
      harness.store.updateWorkflowState(
        taskId,
        "running",
        0, // Reset to step 0
        JSON.stringify({}), // Clear outputs for retry
        now,
        null, // Clear error code
      );
    });

    workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow!.currentStepIndex, 0, "Should be reset to step 0");
    assert.equal(workflow!.lastErrorCode, null, "Error should be cleared");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Multi-step observe with step outputs aggregation
// ---------------------------------------------------------------------------

test("E2E Orchestration Loop: observe aggregates step outputs throughout workflow", async () => {
  const harness = createE2EHarness("aa-e2e-observe-aggregate-");
  try {
    const taskId = newId("task");
    const traceId = newId("trace");
    const now = nowIso();

    // Setup 3-step workflow
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Aggregate observe test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "aggregate workflow" }),
        normalizedInputJson: JSON.stringify({ request: "aggregate workflow" }),
        outputJson: null,
        estimatedCostUsd: 0.15,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "three_step_wf",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Execute all 3 steps with observe
    const stepData = [
      { stepId: "extract", output: { extracted: "data" }, cost: 50 },
      { stepId: "transform", output: { transformed: "data" }, cost: 75 },
      { stepId: "load", output: { loaded: true }, cost: 25 },
    ];

    let currentOutputs: Record<string, unknown> = {};

    for (let i = 0; i < stepData.length; i++) {
      const step = stepData[i];

      // Execute step
      harness.db.transaction(() => {
        harness.store.workflow.insertStepOutput({
          id: newId("step"),
          taskId,
          stepId: step.stepId,
          roleId: "general_executor",
          status: "succeeded",
          dataJson: JSON.stringify(step.output),
          summary: `${step.stepId} completed`,
          artifactsJson: "[]",
          tokenCost: step.cost,
          durationMs: step.cost * 10,
          validationJson: JSON.stringify({ valid: true }),
          producedAt: now,
        });
      });

      // Observe: record step completion
      harness.db.transaction(() => {
        harness.store.event.insertEvent({
          id: newId("evt"),
          taskId,
          eventType: "workflow:step_completed",
          eventTier: "tier_1" as const,
          payloadJson: JSON.stringify({
            stepId: step.stepId,
            stepIndex: i,
            status: "succeeded",
          }),
          traceId,
          createdAt: now,
        });
      });

      // Aggregate output
      currentOutputs[step.stepId] = step.output;

      // Advance workflow
      harness.db.transaction(() => {
        harness.store.updateWorkflowState(
          taskId,
          i === stepData.length - 1 ? "completed" : "running",
          i + 1,
          JSON.stringify(currentOutputs),
          now,
          null,
        );
      });
    }

    // Verify final state
    const workflow = harness.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "completed", "Workflow should be completed");
    assert.equal(workflow?.currentStepIndex, 3, "Should be at final step index");

    const finalOutputs = JSON.parse(workflow!.outputsJson);
    assert.ok(finalOutputs.extract, "Should have extract output");
    assert.ok(finalOutputs.transform, "Should have transform output");
    assert.ok(finalOutputs.load, "Should have load output");

    // Verify events were recorded for each step
    const events = harness.store.event.listEventsForTask(taskId);
    assert.equal(events.length, 3, "Should have 3 step completed events");

  } finally {
    harness.cleanup();
  }
});
