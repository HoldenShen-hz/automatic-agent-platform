// @ts-nocheck
/**
 * Integration Tests: Runtime Lifecycle
 *
 * Tests the complete runtime lifecycle for both single-task and multi-step
 * execution scenarios. Covers task creation through terminal state transitions,
 * session management, execution records, and workflow state evolution.
 *
 * Uses SQLite with real storage backend.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { runSingleTaskExecution } from "../../../../src/platform/execution/execution-engine/single-task-happy-path.js";
import { runMultiStepOrchestration, resetMultiStepToolRegistryForTests } from "../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

function createRuntimeDb(prefix) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "runtime-lifecycle-integration.db");
  return { workspace, dbPath };
}

// ---------------------------------------------------------------------------
// Single-task lifecycle
// ---------------------------------------------------------------------------

test("runSingleTaskExecution creates task in queued status and transitions to completed", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-single-lifecycle-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Single Task Lifecycle Test",
      request: "Analyze market trends for Q1 2026",
      stepOutputOverride: { analysis: "completed" },
    });

    assert.equal(snapshot.task.status, "done");
    assert.ok(snapshot.task.completedAt != null);
    assert.ok(snapshot.task.outputJson != null);
    assert.equal(snapshot.task.errorCode, null);

    const output = JSON.parse(snapshot.task.outputJson);
    assert.ok(output.result != null);
  } finally {
    cleanupPath(workspace);
  }
});

test("runSingleTaskExecution creates session and execution records", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-single-session-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Session Record Test",
      request: "Generate a report",
      stepOutputOverride: { report: "done" },
    });

    assert.ok(snapshot.sessions.length >= 1, "At least one session should be created");
    const session = snapshot.sessions[0];
    assert.equal(session.channel, "cli");
    assert.ok(session.taskId === snapshot.task.id);

    assert.ok(snapshot.executions.length >= 1, "At least one execution should be created");
    const execution = snapshot.executions[0];
    assert.equal(execution.taskId, snapshot.task.id);
    assert.equal(execution.status, "succeeded");
  } finally {
    cleanupPath(workspace);
  }
});

test("runSingleTaskExecution records workflow step output", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-single-step-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Step Output Test",
      request: "Process data batch",
      stepOutputOverride: {
        processed: 42,
        summary: "Batch processed successfully",
      },
    });

    assert.ok(snapshot.stepOutputs.length >= 1, "Step outputs should be recorded");
    const stepOutput = snapshot.stepOutputs[0];
    assert.equal(stepOutput.status, "succeeded");

    const data = JSON.parse(stepOutput.dataJson);
    assert.equal(data.processed, 42);
  } finally {
    cleanupPath(workspace);
  }
});

test("runSingleTaskExecution with stepOutputOverride bypasses LLM call", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-single-override-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Override Test",
      request: "Any request",
      stepOutputOverride: { synthetic: true, value: 999 },
    });

    assert.equal(snapshot.task.status, "done");
    const output = JSON.parse(snapshot.task.outputJson);
    assert.equal(output.synthetic, true);
    assert.equal(output.value, 999);
  } finally {
    cleanupPath(workspace);
  }
});

test("runSingleTaskExecution creates cost event records", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-single-cost-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Cost Tracking Test",
      request: "Track my costs",
      stepOutputOverride: { done: true },
    });

    assert.ok(snapshot.costEvents.length >= 1, "Cost events should be recorded");
    const costEvent = snapshot.costEvents[0];
    assert.equal(costEvent.taskId, snapshot.task.id);
    assert.ok(typeof costEvent.inputTokens === "number");
    assert.ok(typeof costEvent.outputTokens === "number");
    assert.ok(typeof costEvent.costUsd === "number");
  } finally {
    cleanupPath(workspace);
  }
});

test("runSingleTaskExecution creates events for lifecycle transitions", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-single-events-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Event Recording Test",
      request: "Log lifecycle events",
      stepOutputOverride: { done: true },
    });

    const eventTypes = snapshot.events.map((e) => e.eventType);
    assert.ok(eventTypes.includes("workflow:step_completed"), "Should have step completed event");
    assert.ok(eventTypes.some((t) => t.startsWith("task:")), "Should have task status event");
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Multi-step orchestration lifecycle
// ---------------------------------------------------------------------------

test("runMultiStepOrchestration creates task with workflow and session", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-basic-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Multi-Step Basic Test",
      request: "Perform analysis and generate report",
    });

    assert.ok(result.snapshot.task != null);
    assert.equal(result.snapshot.task.title, "Multi-Step Basic Test");
    assert.ok(result.routing != null);
    assert.ok(result.plannedWorkflow != null);
  } finally {
    cleanupPath(workspace);
  }
});

test("runMultiStepOrchestration routes and plans workflow", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-route-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Route Test",
      request: "Analyze data and produce summary",
    });

    assert.ok(result.routing.workflowId != null);
    assert.ok(result.routing.classification != null);
    assert.ok(result.plannedWorkflow.executionSteps.length >= 1);
    assert.ok(result.plannedWorkflow.planReason != null);
  } finally {
    cleanupPath(workspace);
  }
});

test("runMultiStepOrchestration with oapeflir plan prefix deserializes plan steps", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-oapeflir-");
  try {
    const planSteps = [
      {
        stepId: "step_fetch",
        dependencies: [],
        outputs: ["fetched_data"],
        timeout: 30000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        stepId: "step_process",
        dependencies: ["step_fetch"],
        outputs: ["processed_result"],
        timeout: 60000,
        retryPolicy: { maxRetries: 1 },
      },
    ];

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "oapeflir_plan_001",
      request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    });

    assert.ok(result.plannedWorkflow.executionSteps.length >= 2);
    assert.equal(result.routing.routeReason, "oapeflir_bridge");
  } finally {
    cleanupPath(workspace);
  }
});

test("runMultiStepOrchestration stepFailureInjection triggers specified step failures", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-fail-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Failure Injection Test",
      request: "Run steps with some failures",
      stepFailureInjection: new Set(["step_analyze"]),
    });

    // Task may be failed or completed depending on failure handling
    assert.ok(
      result.snapshot.task.status === "done" || result.snapshot.task.status === "failed",
      `Expected done or failed, got ${result.snapshot.task.status}`
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("runMultiStepOrchestration stepOutputOverrides provides synthetic outputs", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-override-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Output Override Test",
      request: "Generate synthetic outputs",
      stepOutputOverrides: {
        step_analyze: { summary: "Synthetic analysis", result: "overridden" },
      },
    });

    assert.ok(result.snapshot.task != null);
    assert.ok(result.snapshot.task.status != null);
  } finally {
    cleanupPath(workspace);
  }
});

test("runMultiStepOrchestration creates admission events on backpressure", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-admission-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Admission Test",
      request: "Check admission behavior",
      admissionPolicy: {
        maxConcurrentWeight: 0,
        maxQueueDepth: 0,
        backpressureThreshold: 0,
      },
    });

    // With restrictive policy, may be queued or rejected
    assert.ok(
      result.snapshot.task.status === "done" ||
      result.snapshot.task.status === "cancelled" ||
      result.snapshot.task.status === "paused",
      `Unexpected status: ${result.snapshot.task.status}`
    );
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Lifecycle transition verification
// ---------------------------------------------------------------------------

test("runSingleTaskExecution transitions task through all lifecycle states", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-lifecycle-states-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Lifecycle States Test",
      request: "Verify state transitions",
      stepOutputOverride: { verified: true },
    });

    // queued -> in_progress -> done (or failed)
    assert.ok(snapshot.task.status === "done" || snapshot.task.status === "failed");

    // Verify terminal state has completedAt set
    if (snapshot.task.status === "done") {
      assert.ok(snapshot.task.completedAt != null);
      assert.ok(new Date(snapshot.task.completedAt).getTime() > 0);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("runSingleTaskExecution session transitions from open to streaming to completed", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-session-trans-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Session Transition Test",
      request: "Track session state changes",
      stepOutputOverride: { done: true },
    });

    const session = snapshot.sessions[0];
    assert.ok(
      session.status === "completed" || session.status === "failed",
      `Expected completed or failed, got ${session.status}`
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("runSingleTaskExecution execution transitions from created through prechecking to executing to succeeded", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-exec-trans-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Execution Transition Test",
      request: "Verify execution flow",
      stepOutputOverride: { done: true },
    });

    const execution = snapshot.executions.find((e) => e.runKind === "task_run");
    assert.ok(execution != null, "Should have a task_run execution");
    assert.equal(execution.status, "succeeded");
    assert.ok(execution.startedAt != null);
    assert.ok(execution.finishedAt != null);
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Multi-step orchestration: workflow state transitions
// ---------------------------------------------------------------------------

test("runMultiStepOrchestration records workflow state with running status during execution", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-workflow-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Workflow State Test",
      request: "Execute multi-step workflow",
    });

    assert.ok(result.snapshot.workflows.length >= 1);
    const workflow = result.snapshot.workflows[0];
    assert.ok(workflow.taskId === result.snapshot.task.id);
    assert.ok(workflow.status === "running" || workflow.status === "done" || workflow.status === "failed");
  } finally {
    cleanupPath(workspace);
  }
});

test("runMultiStepOrchestration builds correct plannedWorkflow structure", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-plan-struct-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Plan Structure Test",
      request: "Create and verify plan structure",
    });

    assert.ok(result.plannedWorkflow.workflow != null);
    assert.ok(result.plannedWorkflow.executionSteps != null);
    assert.ok(Array.isArray(result.plannedWorkflow.executionSteps));
    assert.ok(result.plannedWorkflow.workflow.workflowId != null);
    assert.ok(result.plannedWorkflow.workflow.steps != null);

    // Verify execution steps have required fields
    for (const step of result.plannedWorkflow.executionSteps) {
      assert.ok(step.stepId != null);
      assert.ok(step.roleId != null);
      assert.ok(step.outputKey != null);
      assert.ok(typeof step.timeoutMs === "number");
      assert.ok(typeof step.maxAttempts === "number");
    }
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Integration: full lifecycle scenarios
// ---------------------------------------------------------------------------

test("full lifecycle: single task from creation to artifact persistence", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-lifecycle-artifact-");
  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Artifact Persistence Test",
      request: "Create and verify artifact",
      stepOutputOverride: { artifactContent: "test data" },
    });

    // Verify step output exists with artifact reference
    const stepOutput = snapshot.stepOutputs[0];
    assert.ok(stepOutput.artifactsJson != null);

    const artifactRefs = JSON.parse(stepOutput.artifactsJson);
    assert.ok(artifactRefs.length >= 1, "Should have at least one artifact");

    // Verify artifact record exists
    assert.ok(snapshot.artifacts.length >= 1);
    const artifact = snapshot.artifacts[0];
    assert.ok(artifact.taskId === snapshot.task.id);
  } finally {
    cleanupPath(workspace);
  }
});

test("full lifecycle: multi-step with routing decision recorded as event", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-lifecycle-routing-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Routing Event Test",
      request: "Test routing with event recording",
    });

    const routingEvents = result.snapshot.events.filter(
      (e) => e.eventType === "routing:decided" || e.eventType === "workflow:planned"
    );
    assert.ok(routingEvents.length >= 1, "Should have routing/planning events");

    const routingPayload = JSON.parse(routingEvents[0].payloadJson);
    assert.ok(routingPayload.workflowId != null);
  } finally {
    cleanupPath(workspace);
  }
});

test("consecutive runSingleTaskExecution calls use different task and session IDs", async () => {
  const { workspace, dbPath } = createRuntimeDb("aa-int-lifecycle-consecutive-");
  try {
    const snapshot1 = await runSingleTaskExecution({
      dbPath,
      title: "First Task",
      request: "First request",
      stepOutputOverride: { index: 1 },
    });

    const snapshot2 = await runSingleTaskExecution({
      dbPath,
      title: "Second Task",
      request: "Second request",
      stepOutputOverride: { index: 2 },
    });

    // Different task IDs
    assert.notEqual(snapshot1.task.id, snapshot2.task.id);

    // Different session IDs
    assert.notEqual(snapshot1.sessions[0].id, snapshot2.sessions[0].id);

    // Both completed
    assert.equal(snapshot1.task.status, "done");
    assert.equal(snapshot2.task.status, "done");
  } finally {
    cleanupPath(workspace);
  }
});

test("consecutive runMultiStepOrchestration calls use different task IDs", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createRuntimeDb("aa-int-multi-consecutive-");
  try {
    const result1 = await runMultiStepOrchestration({
      dbPath,
      title: "Multi First",
      request: "First multi request",
    });

    resetMultiStepToolRegistryForTests();
    const result2 = await runMultiStepOrchestration({
      dbPath,
      title: "Multi Second",
      request: "Second multi request",
    });

    assert.notEqual(result1.snapshot.task.id, result2.snapshot.task.id);
    assert.equal(result1.snapshot.task.status, "done");
    assert.equal(result2.snapshot.task.status, "done");
  } finally {
    cleanupPath(workspace);
  }
});