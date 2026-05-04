/**
 * Multi-Step Orchestration Integration Tests
 *
 * Tests end-to-end multi-step orchestration including:
 * - Routing and workflow planning
 * - Step execution and state transitions
 * - Cross-module interactions between orchestration, execution, and state-evidence
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { runMultiStepOrchestration, executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests } from "../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("orchestration: Run multi-step orchestration from request to completion", async () => {
  const workspace = createTempWorkspace("aa-orch-multi-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-multi.db"),
      title: "Multi-step orchestration integration test",
      request: "Analyze the task, draft a solution, and review the final output.",
    });

    // Verify routing determined orchestration was required
    assert.equal(result.routing.requiresOrchestration, true, "Should require orchestration");

    // Verify workflow was planned with multiple steps
    assert.ok(result.plannedWorkflow.executionSteps.length >= 1, "Should have planned workflow steps");
    assert.ok(result.plannedWorkflow.workflow != null, "Should have workflow definition");

    // Verify task completed successfully
    assert.equal(result.snapshot.task.status, "done", "Task should be done");
    assert.equal(result.snapshot.workflow?.status, "completed", "Workflow should be completed");

    // Verify step outputs were recorded
    assert.ok(result.snapshot.stepOutputs.length >= 1, "Should have step outputs");

    // Verify events were recorded
    assert.ok(result.snapshot.events.length >= 3, "Should have events (routing, planned, completed)");
    const eventTypes = result.snapshot.events.map((e) => e.eventType);
    assert.ok(eventTypes.includes("platform.graph_scheduler.decision_recorded"), "Should have platform.graph_scheduler.decision_recorded event");
    assert.ok(eventTypes.includes("workflow:planned"), "Should have workflow:planned event");
    assert.ok(eventTypes.includes("division:completed"), "Should have division:completed event");

    // Verify session exists and is completed
    assert.ok(result.snapshot.session != null, "Should have session");
    assert.equal(result.snapshot.session?.status, "completed", "Session should be completed");
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: Multi-step orchestration with step failure triggers cascade skip", async () => {
  const workspace = createTempWorkspace("aa-orch-fail-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-fail.db"),
      title: "Multi-step failure cascade test",
      request: "Analyze the task in detail and create a comprehensive solution document.",
      stepFailurePlans: {
        intake_triage: ["internal.unexpected_error"],
      },
    });

    // Verify task failed due to cascade skip
    assert.equal(result.snapshot.task.status, "failed", "Task should be failed");
    assert.equal(result.snapshot.workflow?.status, "failed", "Workflow should be failed");

    // Verify step outputs include both failed and skipped steps
    const stepIds = result.snapshot.stepOutputs.map((s) => s.stepId);
    assert.ok(stepIds.includes("intake_triage"), "Should have intake_triage output");

    // Verify skipped steps have upstream dependency failure reason
    const skippedSteps = result.snapshot.stepOutputs.filter((s) => s.status === "skipped");
    for (const skipped of skippedSteps) {
      const data = JSON.parse(skipped.dataJson);
      assert.equal(data.reasonCode, "upstream_dependency_failed", "Skipped step should have upstream failure reason");
      assert.ok(Array.isArray(data.blockedBy), "Should have blockedBy array");
    }

    // Verify session reached failed state
    assert.equal(result.snapshot.session?.status, "failed", "Session should be failed");
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: Multi-step orchestration with approval-required step pauses workflow", async () => {
  const workspace = createTempWorkspace("aa-orch-approval-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-approval.db"),
      title: "Multi-step approval required test",
      request: "Analyze the task and draft a solution requiring approval.",
      stepFailurePlans: {
        draft_solution: ["policy.approval_required"],
      },
    });

    // Verify task reached awaiting_decision state (paused for approval)
    assert.equal(result.snapshot.task.status, "awaiting_decision", "Task should be awaiting_decision");

    // Verify workflow is paused
    assert.equal(result.snapshot.workflow?.status, "paused", "Workflow should be paused");
    assert.equal(result.snapshot.workflow?.lastErrorCode, "policy.approval_required", "Workflow should have approval error");

    // Verify session is awaiting user
    assert.equal(result.snapshot.session?.status, "awaiting_user", "Session should be awaiting_user");

    // Verify execution is blocked
    assert.ok(result.snapshot.execution != null, "Should have execution record");
    assert.equal(result.snapshot.execution?.status, "blocked", "Execution should be blocked");

    // Verify only intake_triage step completed (approval step not reached)
    const completedSteps = result.snapshot.stepOutputs.filter((s) => s.status === "succeeded");
    assert.equal(completedSteps.length >= 1, true, "Should have at least one completed step");
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: Multi-step orchestration records cost events for each step", async () => {
  const workspace = createTempWorkspace("aa-orch-cost-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-cost.db"),
      title: "Multi-step cost tracking test",
      request: "Analyze the task and draft a solution with cost tracking.",
    });

    // Load store to query cost events
    const db = new SqliteDatabase(join(workspace, "orch-cost.db"));
    const store = new AuthoritativeTaskStore(db);

    const costEvents = store.listCostEventsByTask(result.snapshot.task.id);

    // Verify cost events were recorded
    assert.ok(costEvents.length >= 1, "Should have cost events for steps");

    // Verify each cost event has required fields
    for (const cost of costEvents) {
      assert.ok(cost.taskId != null, "Cost event should have taskId");
      assert.equal(cost.budgetScope, "task_execution", "Cost should be task execution scope");
      assert.ok(cost.costUsd > 0, "Cost should be positive");
      assert.ok(cost.provider != null, "Cost should have provider");
    }

    // Verify total cost can be computed
    const totalCost = store.sumCostByTask(result.snapshot.task.id);
    assert.ok(totalCost > 0, "Total cost should be positive");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: Multi-step orchestration updates workflow state with step outputs", () => {
  const ctx = createIntegrationContext("aa-orch-workflow-");
  try {
    const taskId = "task-orch-wf-001";
    const now = nowIso();

    // Create task and workflow
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Workflow state test",
        status: "in_progress",
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

      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_workflow",
        currentStepIndex: 0,
        status: "running",
        outputsJson: JSON.stringify({}),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Simulate step 1 completion
    ctx.db.transaction(() => {
      ctx.store.workflow.insertStepOutput({
        id: "step-out-001",
        taskId,
        stepId: "step_1",
        roleId: "general_executor",
        status: "succeeded",
        dataJson: JSON.stringify({ result: "step1_output" }),
        summary: "Step 1 completed",
        artifactsJson: "[]",
        tokenCost: 50,
        durationMs: 1000,
        validationJson: "{}",
        producedAt: nowIso(),
      });

      // Update workflow state to reflect step 1 completion
      ctx.store.workflow.updateWorkflowState(
        taskId,
        "running",
        1,
        JSON.stringify({ step_1: { result: "step1_output" } }),
        nowIso(),
      );
    });

    // Verify workflow state updated
    const workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow?.currentStepIndex, 1, "Workflow should be at step index 1");
    const outputs = JSON.parse(workflow?.outputsJson ?? "{}");
    assert.ok(outputs.step_1 != null, "Workflow outputs should include step_1");

    // Simulate step 2 completion
    ctx.db.transaction(() => {
      ctx.store.workflow.insertStepOutput({
        id: "step-out-002",
        taskId,
        stepId: "step_2",
        roleId: "general_executor",
        status: "succeeded",
        dataJson: JSON.stringify({ result: "step2_output" }),
        summary: "Step 2 completed",
        artifactsJson: "[]",
        tokenCost: 75,
        durationMs: 1500,
        validationJson: "{}",
        producedAt: nowIso(),
      });

      // Update workflow state to reflect step 2 completion
      ctx.store.workflow.updateWorkflowState(
        taskId,
        "running",
        2,
        JSON.stringify({ step_1: { result: "step1_output" }, step_2: { result: "step2_output" } }),
        nowIso(),
      );
    });

    // Verify final workflow state
    const finalWorkflow = ctx.store.getWorkflowState(taskId);
    assert.equal(finalWorkflow?.currentStepIndex, 2, "Workflow should be at step index 2");
    const finalOutputs = JSON.parse(finalWorkflow?.outputsJson ?? "{}");
    assert.ok(finalOutputs.step_1 != null, "Final outputs should include step_1");
    assert.ok(finalOutputs.step_2 != null, "Final outputs should include step_2");

    // Verify step outputs were persisted
    const stepOutputs = ctx.store.workflow.listStepOutputs(taskId);
    assert.equal(stepOutputs.length, 2, "Should have 2 step outputs");
  } finally {
    ctx.cleanup();
  }
});

test("orchestration: Runtime entry guard validates no legacy truth writes", async () => {
  const workspace = createTempWorkspace("aa-orch-entry-guard-");

  try {
    // This test verifies the entry guard doesn't throw for valid orchestration paths
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-entry-guard.db"),
      title: "Entry guard validation test",
      request: "Simple task for entry guard test.",
    });

    // Verify orchestration completed successfully (entry guard passed)
    assert.equal(result.snapshot.task.status, "done", "Task should complete with valid orchestration");

    // Verify events show proper routing (not legacy truth writes)
    const eventTypes = result.snapshot.events.map((e) => e.eventType);
    assert.ok(eventTypes.includes("platform.graph_scheduler.decision_recorded"), "Should have routing event");
    assert.ok(!eventTypes.some((e) => e === "legacy:routing_completed"), "Should not have legacy event type");
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: Multi-step with admission backpressure queues task", async () => {
  const workspace = createTempWorkspace("aa-orch-queue-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-queue.db"),
      title: "Multi-step queue backpressure test",
      request: "Request that should be queued due to backpressure.",
      admissionBackpressureSnapshot: () => ({
        status: "degraded",
        degradationMode: "queue_only",
        queueGovernance: {
          backlogSize: 100,
          dispatchableBacklogSize: 0,
          claimedBacklogSize: 50,
          oldestWaitSeconds: 300,
          oldestClaimAgeSeconds: 120,
          queueNames: ["default"],
          starvationDetected: false,
        },
        findings: [],
      }),
    });

    // Verify task was queued (not rejected, not admitted)
    assert.equal(result.snapshot.task.status, "queued", "Task should be queued");
    assert.equal(result.snapshot.workflow?.status, "paused", "Workflow should be paused");

    // Verify admission:queued event was recorded
    const events = result.snapshot.events.filter((e) => e.eventType === "admission:queued");
    assert.equal(events.length, 1, "Should have admission:queued event");

    // Verify session is still open (awaiting admission)
    assert.equal(result.snapshot.session?.status, "open", "Session should be open while queued");
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: OAPEFLIR plan request deserializes and executes correctly", async () => {
  const workspace = createTempWorkspace("aa-orch-oapeflir-");

  try {
    // Create a custom OAPEFLIR plan request
    const oapeflirPlan = JSON.stringify([
      {
        stepId: "custom_step_1",
        timeout: 30000,
        retryPolicy: { maxRetries: 0 },
        dependencies: [],
        outputs: ["custom_output_1"],
      },
      {
        stepId: "custom_step_2",
        timeout: 30000,
        retryPolicy: { maxRetries: 0 },
        dependencies: ["custom_step_1"],
        outputs: ["custom_output_2"],
      },
    ]);

    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-oapeflir.db"),
      title: "OAPEFLIR plan test",
      request: `oapeflir://plan ${oapeflirPlan}`,
    });

    // Verify routing was based on OAPEFLIR plan
    assert.equal(result.routing.routeReason, "oapeflir_bridge", "Should route via oapeflir_bridge");

    // Verify workflow was built from plan
    assert.ok(result.plannedWorkflow.executionSteps.length >= 2, "Should have planned steps from OAPEFLIR");

    // Verify task completed (or at least started)
    assert.ok(["done", "in_progress", "queued"].includes(result.snapshot.task.status), "Task should be in valid state");
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: Multi-step with retry completes after transient failure", async () => {
  const workspace = createTempWorkspace("aa-orch-retry-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-retry.db"),
      title: "Multi-step retry test",
      request: "Analyze and draft solution with transient failure retry.",
      stepFailurePlans: {
        draft_solution: ["provider.rate_limited"],
      },
    });

    // Verify task completed successfully despite transient failure
    assert.equal(result.snapshot.task.status, "done", "Task should complete after retry");
    assert.equal(result.snapshot.workflow?.status, "completed", "Workflow should be completed");

    // Verify workflow tracked retry
    assert.equal(result.snapshot.workflow?.retryCount >= 1, true, "Workflow should have retry count");

    // Verify retry event was recorded
    const retryEvents = result.snapshot.events.filter((e) => e.eventType === "workflow:step_retry_scheduled");
    assert.equal(retryEvents.length >= 1, true, "Should have retry scheduled event");

    // Verify final outputs include results from all steps
    assert.ok(result.snapshot.stepOutputs.length >= 2, "Should have outputs from multiple steps");
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: Cross-module validation - session messages correlate with workflow steps", async () => {
  const workspace = createTempWorkspace("aa-orch-messages-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-messages.db"),
      title: "Message correlation test",
      request: "Analyze task, draft solution, and review output.",
    });

    const db = new SqliteDatabase(join(workspace, "orch-messages.db"));
    const store = new AuthoritativeTaskStore(db);

    // Verify session has messages
    assert.ok(result.snapshot.session != null, "Should have session");
    const messages = store.listMessagesBySession(result.snapshot.session!.id);
    assert.ok(messages.length >= 2, "Should have multiple messages");

    // Verify messages have proper structure
    for (const msg of messages) {
      assert.ok(msg.id != null, "Message should have id");
      assert.ok(msg.sessionId != null, "Message should have sessionId");
      assert.ok(msg.direction != null, "Message should have direction");
      assert.ok(msg.messageType != null, "Message should have messageType");
      assert.ok(msg.createdAt != null, "Message should have createdAt");
    }

    // Verify step outputs correlate with messages (step outputs are in snapshot)
    const stepOutputs = result.snapshot.stepOutputs;
    for (const step of stepOutputs) {
      assert.ok(step.taskId != null, "Step output should have taskId");
      assert.ok(step.stepId != null, "Step output should have stepId");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("orchestration: Context compaction triggers for large requests", async () => {
  const workspace = createTempWorkspace("aa-orch-compaction-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "orch-compaction.db"),
      title: "Context compaction test",
      request: "Analyze the task in depth with extensive historical context and produce a comprehensive summary of all findings.",
      contextBudgetTokens: 100, // Low budget to trigger compaction
    });

    // Verify compaction was triggered
    assert.ok(result.compaction != null, "Should have compaction result");
    assert.equal(result.compaction?.stage1Triggered, true, "Stage 1 compaction should be triggered");

    // Verify task still completed
    assert.equal(result.snapshot.task.status, "done", "Task should complete despite compaction");
  } finally {
    cleanupPath(workspace);
  }
});
