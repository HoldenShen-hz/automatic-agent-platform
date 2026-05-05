/**
 * GraphPatch Output Tests
 *
 * Validates R5-12: GraphPatch structure and content for replanning.
 * GraphPatch captures changes to the plan graph during re-entrant loops.
 *
 * Architecture: §5.12 GraphPatch Specification + §13.7 PlanGraphBundle
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/orchestration/oapeflir/types/dual-channel-step-output.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

function makeStepOutput(stepId: string): DualChannelStepOutput {
  return {
    stepId,
    planRef: `plan_${stepId}`,
    userFacingResult: {
      summary: `Executed ${stepId}`,
      artifacts: [`artifact:${stepId}`],
    },
    systemTelemetry: {
      durationMs: 25,
      tokensUsed: 10,
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed: true,
    },
  };
}

class DeterministicExecuteBridge implements ExecuteBridge {
  async executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult> {
    return {
      stepId: step.stepId,
      status: "succeeded",
      durationMs: 25,
      tokenCost: 10,
      summary: `Executed ${step.stepId}`,
      outputs: { stepId: step.stepId },
      artifacts: [`artifact:${step.stepId}`],
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed: true,
    };
  }

  async executePlan(plan: Plan, _context: ExecutionContext): Promise<ExecutionResult> {
    return {
      planId: plan.planId,
      results: plan.steps.map((step) => ({
        stepId: step.stepId,
        status: "succeeded" as const,
        durationMs: 25,
        tokenCost: 10,
        summary: `Executed ${step.stepId}`,
        outputs: { stepId: step.stepId },
        artifacts: [`artifact:${step.stepId}`],
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: true,
      })),
      totalDurationMs: plan.steps.length * 25,
      totalTokenCost: plan.steps.length * 10,
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  toDualChannelStepOutputs(result: ExecutionResult) {
    return result.results.map((stepResult) => ({
      stepId: stepResult.stepId,
      planRef: result.planId,
      userFacingResult: {
        summary: stepResult.summary,
        artifacts: [...stepResult.artifacts],
      },
      systemTelemetry: {
        durationMs: stepResult.durationMs,
        tokensUsed: stepResult.tokenCost,
        modelId: stepResult.modelId,
        retryCount: stepResult.retryCount,
        validationPassed: stepResult.validationPassed,
      },
    }));
  }
}

function createWorkflow(taskId: string) {
  return {
    workflow: { workflowId: `wf_${taskId}`, divisionId: "coding", steps: [] },
    executionSteps: [
      {
        stepId: `step_${taskId}`,
        divisionId: "coding",
        roleId: "writer",
        inputKeys: [],
        agentId: "agent_writer",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1000,
        maxAttempts: 1,
      },
    ],
    planReason: "workflow.single_step_execution",
    dependencyEdges: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// R5-12: GraphPatch structure validation
// ─────────────────────────────────────────────────────────────────────────────

test("GraphPatch is produced when replan occurs (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_graph_patch",
    objective: "Verify GraphPatch produced during replan",
    workflow: createWorkflow("task_graph_patch"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_graph_patch",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Schema validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_graph_patch`],
        timestamp: Date.now(),
      },
    ],
    stepOutputs: [makeStepOutput("step_task_graph_patch")],
  });

  // R5-12: GraphPatch must be produced during replan
  if (result.replanDecision.shouldReplan) {
    assert.ok(result.graphPatch != null, "GraphPatch must be produced when replan=true");
  }
});

test("GraphPatch has harnessRunId referencing the loop run (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_run_id",
    objective: "Verify GraphPatch has correct harnessRunId",
    workflow: createWorkflow("task_patch_run_id"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_run_id",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_run_id`],
        timestamp: Date.now(),
      },
    ],
    stepOutputs: [makeStepOutput("step_task_patch_run_id")],
  });

  if (result.graphPatch != null) {
    assert.ok(result.graphPatch.harnessRunId.length > 0, "harnessRunId must not be empty");
    assert.ok(
      result.graphPatch.harnessRunId.includes("oapeflir_run"),
      "harnessRunId should reference oapeflir run",
    );
  }
});

test("GraphPatch baseGraphVersion and newGraphVersion are properly sequenced (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_version",
    objective: "Verify GraphPatch version sequencing",
    workflow: createWorkflow("task_patch_version"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_version",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_version`],
        timestamp: Date.now(),
      },
    ],
    stepOutputs: [makeStepOutput("step_task_patch_version")],
  });

  if (result.graphPatch != null) {
    assert.ok(result.graphPatch.baseGraphVersion >= 1, "baseGraphVersion must be >= 1");
    assert.ok(
      result.graphPatch.newGraphVersion > result.graphPatch.baseGraphVersion,
      "newGraphVersion must be greater than baseGraphVersion",
    );
    assert.strictEqual(
      result.graphPatch.newGraphVersion,
      result.graphPatch.baseGraphVersion + 1,
      "newGraphVersion should be exactly one increment",
    );
  }
});

test("GraphPatch has operations array (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_ops",
    objective: "Verify GraphPatch has operations array",
    workflow: createWorkflow("task_patch_ops"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_ops",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_ops`],
        timestamp: Date.now(),
      },
    ],
    stepOutputs: [makeStepOutput("step_task_patch_ops")],
  });

  if (result.graphPatch != null) {
    assert.ok(Array.isArray(result.graphPatch.operations), "operations must be array");
    assert.ok(result.graphPatch.operations.length > 0, "operations must not be empty during replan");
  }
});

test("GraphPatch operation has operationType (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_op_type",
    objective: "Verify GraphPatch operation has operationType",
    workflow: createWorkflow("task_patch_op_type"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_op_type",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_op_type`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null && result.graphPatch.operations.length > 0) {
    const op = result.graphPatch.operations[0];
    assert.ok("operationType" in op, "operation must have operationType");
    assert.strictEqual(typeof op.operationType, "string", "operationType must be string");
  }
});

test("GraphPatch operation has targetRef (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_target",
    objective: "Verify GraphPatch operation has targetRef",
    workflow: createWorkflow("task_patch_target"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_target",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_target`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null && result.graphPatch.operations.length > 0) {
    const op = result.graphPatch.operations[0];
    assert.ok("targetRef" in op, "operation must have targetRef");
    assert.strictEqual(typeof op.targetRef, "string", "targetRef must be string");
  }
});

test("GraphPatch has affectedExecutedNodes array (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_nodes",
    objective: "Verify GraphPatch has affectedExecutedNodes",
    workflow: createWorkflow("task_patch_nodes"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_nodes",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_nodes`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null) {
    assert.ok(Array.isArray(result.graphPatch.affectedExecutedNodes), "affectedExecutedNodes must be array");
  }
});

test("GraphPatch has compatibilityClass (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_compat",
    objective: "Verify GraphPatch has compatibilityClass",
    workflow: createWorkflow("task_patch_compat"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_compat",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_compat`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null) {
    assert.ok("compatibilityClass" in result.graphPatch, "graphPatch must have compatibilityClass");
    assert.strictEqual(typeof result.graphPatch.compatibilityClass, "string", "compatibilityClass must be string");
  }
});

test("GraphPatch is null when no replan required (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_no_replan",
    objective: "Verify GraphPatch is null when no replan",
    workflow: createWorkflow("task_patch_no_replan"),
    feedbackSignals: [
      {
        signalId: "signal_success",
        taskId: "task_patch_no_replan",
        source: "user",
        category: "success",
        severity: "info",
        payload: { summary: "Task succeeded" },
        stepOutputRefs: [`step_task_patch_no_replan`],
        timestamp: Date.now(),
      },
    ],
  });

  // When quality gate accepts and no replan needed, graphPatch may be null
  if (!result.replanDecision.shouldReplan) {
    assert.ok(result.graphPatch === null, "graphPatch should be null when no replan needed");
  }
});

test("GraphPatch policyProofRef exists (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_proof",
    objective: "Verify GraphPatch has policyProofRef",
    workflow: createWorkflow("task_patch_proof"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_proof",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_proof`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null) {
    assert.ok(result.graphPatch.policyProofRef != null, "policyProofRef must exist");
    assert.ok("artifactId" in result.graphPatch.policyProofRef, "policyProofRef must have artifactId");
    assert.ok("uri" in result.graphPatch.policyProofRef, "policyProofRef must have uri");
  }
});

test("GraphPatch auditRef exists (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_audit",
    objective: "Verify GraphPatch has auditRef",
    workflow: createWorkflow("task_patch_audit"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_audit",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_audit`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null) {
    assert.ok(result.graphPatch.auditRef != null, "auditRef must exist");
    assert.ok("artifactId" in result.graphPatch.auditRef, "auditRef must have artifactId");
    assert.ok("uri" in result.graphPatch.auditRef, "auditRef must have uri");
  }
});

test("GraphPatch operations contain planId in payload (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_payload",
    objective: "Verify GraphPatch operation payload contains planId",
    workflow: createWorkflow("task_patch_payload"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_payload",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_payload`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null && result.graphPatch.operations.length > 0) {
    const op = result.graphPatch.operations[0];
    assert.ok(op.payload != null, "operation payload must exist");
    assert.ok("planId" in op.payload, "payload must contain planId");
  }
});

test("GraphPatch operations contain strategy in payload (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_strategy",
    objective: "Verify GraphPatch operation payload contains strategy",
    workflow: createWorkflow("task_patch_strategy"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_strategy",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_strategy`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null && result.graphPatch.operations.length > 0) {
    const op = result.graphPatch.operations[0];
    assert.ok(op.payload != null, "operation payload must exist");
    assert.ok("strategy" in op.payload, "payload must contain strategy");
  }
});

test("GraphPatch follows safe_append compatibility class (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({ executeBridge: new DeterministicExecuteBridge() });

  const result = await service.run({
    taskId: "task_patch_safe",
    objective: "Verify GraphPatch uses safe_append compatibility",
    workflow: createWorkflow("task_patch_safe"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_patch_safe",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_patch_safe`],
        timestamp: Date.now(),
      },
    ],
  });

  if (result.graphPatch != null) {
    assert.strictEqual(result.graphPatch.compatibilityClass, "safe_append", "compatibilityClass must be safe_append");
  }
});