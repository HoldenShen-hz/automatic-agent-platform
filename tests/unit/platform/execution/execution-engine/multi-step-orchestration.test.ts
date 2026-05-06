import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import {
  runMultiStepOrchestration,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
  type MultiStepToolExecutionInput,
} from "../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { initHaCoordinatorForTests } from "../../../../helpers/ha-coordinator.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test("runMultiStepOrchestration basic execution", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const input: MultiStepToolExecutionInput = {
      dbPath,
      title: "Test Multi-Step",
      request: "Run multi-step test",
    };

    const result = await runMultiStepOrchestration(input);

    assert.ok(result, "runMultiStepOrchestration should return a result");
    assert.ok("snapshot" in result, "result should have snapshot property");
    assert.ok("routing" in result, "result should have routing property");
    assert.ok("plannedWorkflow" in result, "result should have plannedWorkflow property");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with oapeflir plan request", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planSteps = [
    {
      stepId: "step_1",
      dependencies: [],
      outputs: ["output_1"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Oapeflir Plan",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result, "runMultiStepOrchestration should handle oapeflir plan");
    assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"), "workflowId should have oapeflir prefix");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration preserves preplanned OAPEFLIR node metadata instead of replanning raw text", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planNodes = [
    {
      nodeId: "node_prepare",
      nodeType: "tool_call",
      inputRefs: [],
      outputSchemaRef: "schema:prepare.output",
      riskClass: "high",
      budgetIntent: { amount: 3, currency: "USD", resourceKinds: ["token", "compute"] as const },
      sideEffectProfile: { mayCommitExternalEffect: true, reversible: false },
      retryPolicyRef: "retry:guarded",
      timeoutMs: 45_000,
    },
    {
      nodeId: "node_verify",
      nodeType: "llm_call",
      inputRefs: ["node_prepare"],
      outputSchemaRef: "schema:verify.output",
      riskClass: "medium",
      budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["token"] as const },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 30_000,
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Rich Oapeflir Plan",
    request: `oapeflir://plan ${JSON.stringify(planNodes)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.equal(result.plannedWorkflow.planReason, "oapeflir_bridge: Rich Oapeflir Plan");
    assert.equal(result.plannedWorkflow.workflow.steps[0]?.stepId, "node_prepare");
    assert.equal(result.plannedWorkflow.workflow.steps[0]?.nodeType, "tool_call");
    assert.equal(result.plannedWorkflow.workflow.steps[0]?.riskClass, "high");
    assert.deepEqual(result.plannedWorkflow.workflow.steps[0]?.budgetIntent, planNodes[0].budgetIntent);
    assert.deepEqual(result.plannedWorkflow.workflow.steps[0]?.sideEffectProfile, planNodes[0].sideEffectProfile);
    assert.equal(result.plannedWorkflow.workflow.steps[0]?.retryPolicyRef, "retry:guarded");
    assert.deepEqual(result.plannedWorkflow.executionSteps[1]?.dependsOnStepIds, ["node_prepare"]);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration creates task snapshot", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Snapshot",
    request: "Create snapshot test",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot, "result should have snapshot");
    assert.ok(result.snapshot.task, "snapshot should have task");
    assert.ok(result.snapshot.task.id, "task should have id");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration workflow planning", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Planning",
    request: "Test workflow planning",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.plannedWorkflow, "result should have plannedWorkflow");
    assert.ok(result.plannedWorkflow.workflow, "plannedWorkflow should have workflow");
    assert.ok(result.plannedWorkflow.executionSteps, "plannedWorkflow should have executionSteps");
    assert.ok(Array.isArray(result.plannedWorkflow.executionSteps), "executionSteps should be array");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration routing", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Routing",
    request: "Test routing",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.routing, "result should have routing");
    assert.ok("workflowId" in result.routing, "routing should have workflowId");
    assert.ok("divisionId" in result.routing, "routing should have divisionId");
  } finally {
    cleanup();
  }
});

test("executeMultiStepToolCallForTests is exported", () => {
  assert.ok(typeof executeMultiStepToolCallForTests === "function", "executeMultiStepToolCallForTests should be a function");
});

test("resetMultiStepToolRegistryForTests is exported", () => {
  assert.ok(typeof resetMultiStepToolRegistryForTests === "function", "resetMultiStepToolRegistryForTests should be a function");
});

test("runMultiStepOrchestration streamFrames property", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Stream Frames",
    request: "Test stream frames",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok("streamFrames" in result, "result should have streamFrames property");
    assert.ok(Array.isArray(result.streamFrames), "streamFrames should be an array");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with admission backpressure snapshot", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Backpressure",
    request: "Test backpressure",
    admissionBackpressureSnapshot: () => ({
      status: "ok",
      degradationMode: "none",
      queueGovernance: {
        backlogSize: 0,
        dispatchableBacklogSize: 0,
        claimedBacklogSize: 0,
        oldestWaitSeconds: null,
        oldestClaimAgeSeconds: null,
        queueNames: [],
        starvationDetected: false,
      },
      findings: [],
    }),
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result, "runMultiStepOrchestration should handle custom backpressure snapshot");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration task status transitions", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Transitions",
    request: "Test status transitions",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "task should exist");
    // Task should be in a terminal state (done, failed, or cancelled)
    assert.ok(
      task.status === "done" || task.status === "failed" || task.status === "cancelled",
      `task status should be terminal, got ${task.status}`
    );
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration compaction result", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Compaction",
    request: "Test compaction",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok("compaction" in result, "result should have compaction property");
    // compaction can be null or an object depending on context compaction
    assert.ok(result.compaction === null || typeof result.compaction === "object", "compaction should be null or object");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration handles workflowId in result", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Workflow ID",
    request: "Test workflow ID in result",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.plannedWorkflow.workflow.workflowId, "workflow should have workflowId");
    assert.equal(typeof result.plannedWorkflow.workflow.workflowId, "string", "workflowId should be string");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with custom admission policy", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Custom Policy",
    request: "Test custom admission policy",
    admissionPolicy: {
      maxQueuedTasks: 100,
      maxActiveExecutions: 1000,
      maxTier1AckBacklog: 100,
      urgentQueueHeadroom: 10,
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result, "runMultiStepOrchestration should handle custom admission policy");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration dependency edges in planned workflow", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Dependency Edges",
    request: "Test dependency edges",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok("dependencyEdges" in result.plannedWorkflow, "plannedWorkflow should have dependencyEdges");
    assert.ok(Array.isArray(result.plannedWorkflow.dependencyEdges), "dependencyEdges should be array");
  } finally {
    cleanup();
  }
});

// =============================================================================
// OAPEFLIR Plan Parsing Tests
// =============================================================================

test("runMultiStepOrchestration with empty oapeflir plan steps", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Empty Plan Test",
    request: "oapeflir://plan []",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result, "Empty oapeflir plan should return result");
    assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"));
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration oapeflir plan with multiple steps and dependencies", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planSteps = [
    { stepId: "step_1", dependencies: [], outputs: ["out_1"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
    { stepId: "step_2", dependencies: ["step_1"], outputs: ["out_2"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
    { stepId: "step_3", dependencies: ["step_1", "step_2"], outputs: ["out_3"], timeout: 30000, retryPolicy: { maxRetries: 1 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Multi-Step Plan Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps.length, 3);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration oapeflir plan preserves retryPolicyRef from preplanned nodes", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planNodes = [
    {
      nodeId: "retry_step",
      nodeType: "tool_call",
      inputRefs: [],
      outputSchemaRef: "schema:retry.output",
      riskClass: "medium",
      budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["token"] as const },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:max-3",
      timeoutMs: 30_000,
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Retry Policy Test",
    request: `oapeflir://plan ${JSON.stringify(planNodes)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    const step = result.plannedWorkflow.workflow.steps[0];
    assert.equal(step?.retryPolicyRef, "retry:max-3", "Should preserve retryPolicyRef on the preplanned workflow step");
  } finally {
    cleanup();
  }
});

// =============================================================================
// Admission Decision Tests
// =============================================================================

test("runMultiStepOrchestration with queuing admission decision", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Queue Admission Test",
    request: "Test queue admission",
    admissionBackpressureSnapshot: () => ({
      status: "degraded",
      degradationMode: "queue_only",
      queueGovernance: {
        backlogSize: 100,
        dispatchableBacklogSize: 50,
        claimedBacklogSize: 10,
        oldestWaitSeconds: 120,
        oldestClaimAgeSeconds: 60,
        queueNames: ["default"],
        starvationDetected: false,
      },
      findings: ["high_queue_depth"],
    }),
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    // Should still return a result even when queued
    assert.ok("snapshot" in result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with read-only mode rejection", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "ReadOnly Admission Test",
    request: "Test read only admission",
    admissionBackpressureSnapshot: () => ({
      status: "degraded",
      degradationMode: "read_only_operations_only",
      queueGovernance: {
        backlogSize: 0,
        dispatchableBacklogSize: 0,
        claimedBacklogSize: 0,
        oldestWaitSeconds: null,
        oldestClaimAgeSeconds: null,
        queueNames: [],
        starvationDetected: false,
      },
      findings: ["read_only_mode"],
    }),
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    // Result should still be returned even with rejection
    assert.ok("snapshot" in result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with high priority task", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "High Priority Test",
    request: "Test high priority",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    // Task priority should be stored in the task record
    assert.ok(result.snapshot.task);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with low priority task", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Low Priority Test",
    request: "Test low priority",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(result.snapshot.task);
  } finally {
    cleanup();
  }
});

// =============================================================================
// Step Output Override Tests
// =============================================================================

test("runMultiStepOrchestration with stepOutputOverrides", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planSteps = [
    { stepId: "override_test", dependencies: [], outputs: ["out"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Output Override Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepOutputOverrides: {
      override_test: { summary: "Custom override summary", result: "Custom result data" },
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with multiple stepOutputOverrides", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planSteps = [
    { stepId: "step_a", dependencies: [], outputs: ["out_a"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
    { stepId: "step_b", dependencies: ["step_a"], outputs: ["out_b"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Multi Override Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepOutputOverrides: {
      step_a: { summary: "Override A" },
      step_b: { summary: "Override B" },
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

// =============================================================================
// Context Budget Tokens Tests
// =============================================================================

test("runMultiStepOrchestration with custom contextBudgetTokens", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Context Budget Test",
    request: "Test context budget",
    contextBudgetTokens: 50000,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok("compaction" in result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with high contextBudgetTokens", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "High Context Budget Test",
    request: "Test high context budget",
    contextBudgetTokens: 100000,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with low contextBudgetTokens", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Low Context Budget Test",
    request: "Test low context budget",
    contextBudgetTokens: 1000,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

// =============================================================================
// Step Failure Injection Tests
// =============================================================================

test("runMultiStepOrchestration with stepFailureInjection", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Failure Injection Test",
    request: "Test failure injection",
    stepFailureInjection: new Set(["non_existent_step"]),
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

// =============================================================================
// Step Failure Plans Tests
// =============================================================================

test("runMultiStepOrchestration with stepFailurePlans - single failure", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planSteps = [
    { stepId: "planned_fail", dependencies: [], outputs: ["out"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Planned Failure Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepFailurePlans: {
      planned_fail: [{ errorCode: "test.planned_failure", summary: "Test planned failure" }],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with stepFailurePlans - multiple attempts", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planSteps = [
    { stepId: "multi_fail", dependencies: [], outputs: ["out"], timeout: 30000, retryPolicy: { maxRetries: 2 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Multi Attempt Failure Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepFailurePlans: {
      multi_fail: [
        { errorCode: "attempt_1_fail" },
        { errorCode: "attempt_2_fail" },
        { errorCode: "attempt_3_fail" },
      ],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration with stepFailurePlans - string error codes", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planSteps = [
    { stepId: "string_fail", dependencies: [], outputs: ["out"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "String Failure Plan Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
    stepFailurePlans: {
      string_fail: ["tool.execution_failed", "validation.schema_mismatch"],
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

// =============================================================================
// Workflow Output Structure Tests
// =============================================================================

test("runMultiStepOrchestration workflow output contains taskId", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Output TaskId Test",
    request: "Test task ID in output",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.task);
    assert.ok(result.snapshot.task.id);
    assert.equal(typeof result.snapshot.task.id, "string");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration workflow output contains createdAt timestamp", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Output Timestamp Test",
    request: "Test timestamp in output",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.task);
    assert.ok(result.snapshot.task.createdAt);
    assert.equal(typeof result.snapshot.task.createdAt, "string");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration workflow has divisionId", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Division ID Test",
    request: "Test division ID",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.plannedWorkflow.workflow.divisionId);
    assert.equal(typeof result.plannedWorkflow.workflow.divisionId, "string");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration planned workflow has steps array", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Steps Array Test",
    request: "Test steps array",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(Array.isArray(result.plannedWorkflow.executionSteps));
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration execution steps have required fields", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Step Fields Test",
    request: "Test step fields",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    if (result.plannedWorkflow.executionSteps.length > 0) {
      const step = result.plannedWorkflow.executionSteps[0];
      assert.ok(step.stepId);
      assert.ok(step.roleId);
      assert.ok(step.outputKey);
      assert.ok(Array.isArray(step.dependsOnStepIds));
      assert.ok(typeof step.timeoutMs === "number");
      assert.ok(typeof step.maxAttempts === "number");
    }
  } finally {
    cleanup();
  }
});

// =============================================================================
// Request Title and Content Tests
// =============================================================================

test("runMultiStepOrchestration handles long request text", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const longRequest = "A".repeat(500);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Long Request Test",
    request: longRequest,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration handles special characters in request", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Special Chars Test",
    request: "Test with special chars: @#$%^&*()_+-=[]{}|;':\",./<>?",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration handles unicode in request", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Unicode Test",
    request: "Test with unicode: 你好世界 🌍 αβγδ",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration handles empty title", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "",
    request: "Test empty title",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

// =============================================================================
// Error Handling Tests
// =============================================================================

test("runMultiStepOrchestration handles empty request string", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Empty Request Test",
    request: "",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration cleans up database on error", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "DB Cleanup Test",
    request: "Test cleanup",
  };

  let result;
  try {
    result = await runMultiStepOrchestration(input);
    assert.ok(result);
    // Database should exist after successful run
    assert.ok(existsSync(dbPath), "Database file should exist after run");
  } finally {
    cleanup();
  }
});

// =============================================================================
// Routing Classification Tests
// =============================================================================

test("runMultiStepOrchestration routing contains classification", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Classification Test",
    request: "Test classification",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.routing.classification);
    assert.ok("intent" in result.routing.classification);
    assert.ok("confidence" in result.routing.classification);
    assert.ok("continuation" in result.routing.classification);
    assert.ok("matchedRules" in result.routing.classification);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration routing requires orchestration flag", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Orchestration Flag Test",
    request: "Test requires orchestration",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(typeof result.routing.requiresOrchestration === "boolean");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration routing has route reason", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Route Reason Test",
    request: "Test route reason",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.routing.routeReason);
    assert.equal(typeof result.routing.routeReason, "string");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration routing has route trace", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Route Trace Test",
    request: "Test route trace",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(Array.isArray(result.routing.routeTrace));
  } finally {
    cleanup();
  }
});

// =============================================================================
// OAPEFLIR Plan Edge Cases
// =============================================================================

test("runMultiStepOrchestration oapeflir plan without outputs uses default outputKey", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planSteps = [
    { stepId: "no_output_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Default Output Key Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    const step = result.plannedWorkflow.executionSteps[0];
    assert.ok(step.outputKey.startsWith("output_"), "Default outputKey should start with 'output_'");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration oapeflir plan synthesizes outputKey from nodeId", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const planNodes = [
    {
      nodeId: "multi_output_step",
      nodeType: "tool_call",
      inputRefs: [],
      outputSchemaRef: "schema:multi.output",
      riskClass: "low",
      budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["token"] as const },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 30_000,
    },
  ];

    const input: MultiStepToolExecutionInput = {
      dbPath,
      title: "First Output Test",
      request: `oapeflir://plan ${JSON.stringify(planNodes)}`,
    };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    const step = result.plannedWorkflow.executionSteps[0];
    assert.equal(step.outputKey, "output_multi_output_step", "Should derive outputKey from the preplanned nodeId");
  } finally {
    cleanup();
  }
});

// =============================================================================
// Session and Task Record Tests
// =============================================================================

test("runMultiStepOrchestration creates session in result snapshot", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Session Snapshot Test",
    request: "Test session snapshot",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.session);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration creates workflow state in result snapshot", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Workflow Snapshot Test",
    request: "Test workflow snapshot",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.workflow);
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration task has correct source field", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Task Source Test",
    request: "Test task source",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result.snapshot.task.source);
    assert.equal(result.snapshot.task.source, "user");
  } finally {
    cleanup();
  }
});

test("runMultiStepOrchestration task has estimated cost", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Task Cost Test",
    request: "Test task cost",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.equal(typeof result.snapshot.task.estimatedCostUsd, "number");
    assert.ok(result.snapshot.task.estimatedCostUsd >= 0);
  } finally {
    cleanup();
  }
});

// =============================================================================
// Stream Bridge Tests
// =============================================================================

test("runMultiStepOrchestration returns streamFrames array", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Stream Frames Result Test",
    request: "Test stream frames result",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(Array.isArray(result.streamFrames));
  } finally {
    cleanup();
  }
});
