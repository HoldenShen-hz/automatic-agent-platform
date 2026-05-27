import test from "node:test";
import assert from "node:assert/strict";
import {
  getPreviousPlannerOutput,
  createDefaultPlannerOutput,
  createDefaultGeneratorOutput,
  createDefaultEvaluatorOutput,
  estimateIterationCost,
} from "../../../../src/platform/five-plane-orchestration/harness/harness-loop-support.js";
import type { HarnessRunRuntimeState, HarnessLoopInput } from "../../../../src/platform/five-plane-orchestration/harness/runtime-types.js";

function createMockHarnessRunRuntimeState(overrides: Partial<HarnessRunRuntimeState> = {}): HarnessRunRuntimeState {
  return {
    harnessRunId: "hrun_test_1",
    runId: "run_1",
    tenantId: "tenant_1",
    confirmedTaskSpecId: "spec_1",
    requestEnvelopeId: "req_1",
    requestHash: "hash_1",
    constraintPackRef: "cp_ref",
    versionLockId: "vl_1",
    budgetLedgerId: "bl_1",
    currentSeq: 1,
    taskId: "task_1",
    domainId: "domain_1",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "full_auto",
      tool_policy: { allowedTools: [] },
      sandboxRequirement: { sandboxMode: "none", timeoutMs: 300000 },
      approvalRequirement: {
        requiredForRiskClass: [],
        approverRoles: [],
        escalationTimeoutMs: 60000,
      },
    },
    planGraphBundle: null as never,
    steps: [
      {
        stepId: "step_1",
        role: "planner",
        stage: "planner",
        iteration: 1,
        semanticPhase: "plan",
        inputs: {},
        outputs: { planId: "plan_task_1", summary: "Test plan" },
        startedAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:01:00.000Z",
        error: null,
      },
      {
        stepId: "step_2",
        role: "generator",
        stage: "generator",
        iteration: 1,
        semanticPhase: "execute",
        inputs: {},
        outputs: { artifact: "artifact_1" },
        startedAt: "2024-01-01T00:01:00.000Z",
        completedAt: "2024-01-01T00:02:00.000Z",
        error: null,
      },
    ],
    nodeRunIds: [],
    maxIterations: 5,
    currentIteration: 1,
    status: "running",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:02:00.000Z",
    completedAt: null,
    pauseReason: null,
    decision: null,
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    ...overrides,
  };
}

function createMockHarnessLoopInput(overrides: Partial<HarnessLoopInput> = {}): HarnessLoopInput {
  return {
    taskId: "task_loop_1",
    domainId: "domain_loop_1",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "full_auto",
      tool_policy: { allowedTools: [] },
      sandboxRequirement: { sandboxMode: "none", timeoutMs: 300000 },
      approvalRequirement: {
        requiredForRiskClass: [],
        approverRoles: [],
        escalationTimeoutMs: 60000,
      },
    },
    ...overrides,
  };
}

test("getPreviousPlannerOutput returns outputs from last planner step [harness-loop-support]", () => {
  const run = createMockHarnessRunRuntimeState();
  const result = getPreviousPlannerOutput(run);
  assert.notEqual(result, null);
  assert.equal(result!.planId, "plan_task_1");
  assert.equal(result!.summary, "Test plan");
});

test("getPreviousPlannerOutput returns null when no planner step exists [harness-loop-support]", () => {
  const run = createMockHarnessRunRuntimeState({
    steps: [
      {
        stepId: "step_1",
        role: "generator",
        stage: "generator",
        iteration: 1,
        semanticPhase: "execute",
        inputs: {},
        outputs: { artifact: "artifact_1" },
        startedAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:01:00.000Z",
        error: null,
      },
    ],
  });
  const result = getPreviousPlannerOutput(run);
  assert.equal(result, null);
});

test("getPreviousPlannerOutput returns null when planner step has no outputs [harness-loop-support]", () => {
  const run = createMockHarnessRunRuntimeState({
    steps: [
      {
        stepId: "step_1",
        role: "planner",
        stage: "planner",
        iteration: 1,
        semanticPhase: "plan",
        inputs: {},
        outputs: null as never,
        startedAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:01:00.000Z",
        error: null,
      },
    ],
  });
  const result = getPreviousPlannerOutput(run);
  assert.equal(result, null);
});

test("getPreviousPlannerOutput returns null when outputs is not an object [harness-loop-support]", () => {
  const run = createMockHarnessRunRuntimeState({
    steps: [
      {
        stepId: "step_1",
        role: "planner",
        stage: "planner",
        iteration: 1,
        semanticPhase: "plan",
        inputs: {},
        outputs: "not an object" as never,
        startedAt: "2024-01-01T00:00:00.000Z",
        completedAt: "2024-01-01T00:01:00.000Z",
        error: null,
      },
    ],
  });
  const result = getPreviousPlannerOutput(run);
  assert.equal(result, null);
});

test("createDefaultPlannerOutput creates valid output [harness-loop-support]", () => {
  const input = createMockHarnessLoopInput({ taskId: "task_123" });
  const result = createDefaultPlannerOutput(input, 1);

  assert.equal(result.planId, "plan-task_123-1");
  assert.equal(result.summary, "Plan 1 for task_123");
  assert.equal(result.costUsd, 0.05);
  assert.equal(result.output, "Plan 1 for domain_loop_1");
  assert.ok(Array.isArray(result.checkpoints));
  assert.equal(result.checkpoints.length, 2);
});

test("createDefaultPlannerOutput increments cost with iteration [harness-loop-support]", () => {
  const input = createMockHarnessLoopInput({ taskId: "task_456" });

  const result0 = createDefaultPlannerOutput(input, 0);
  const result1 = createDefaultPlannerOutput(input, 1);
  const result3 = createDefaultPlannerOutput(input, 3);

  assert.equal(result0.costUsd, 0);
  assert.equal(result1.costUsd, 0.05);
  assert.equal(result3.costUsd, 0.15);
});

test("createDefaultGeneratorOutput uses planner output planId [harness-loop-support]", () => {
  const input = createMockHarnessLoopInput({ taskId: "task_gen" });
  const plannerOutput = { planId: "custom_plan_123", summary: "Custom plan" };

  const result = createDefaultGeneratorOutput(input, 2, plannerOutput);

  assert.ok(String(result["artifact"]).includes("artifact-task_gen-2"));
  assert.ok(String(result["summary"]).includes("custom_plan_123"));
  assert.equal(result["costUsd"], 0.2);
});

test("createDefaultGeneratorOutput uses taskId when plannerOutput planId is undefined [harness-loop-support]", () => {
  const input = createMockHarnessLoopInput({ taskId: "task_fallback" });
  const plannerOutput = { summary: "Some plan" };

  const result = createDefaultGeneratorOutput(input, 1, plannerOutput);

  assert.ok(String(result["summary"]).includes("task_fallback"));
});

test("createDefaultEvaluatorOutput creates pass verdict [harness-loop-support]", () => {
  const input = createMockHarnessLoopInput({ taskId: "task_eval" });
  const generatorOutput = { artifact: "artifact_abc" };

  const result = createDefaultEvaluatorOutput(input, 1, generatorOutput);

  assert.equal(result["verdict"], "pass");
  assert.equal(result["score"], 0.86);
  assert.equal(result["costUsd"], 0.02);
  assert.ok(String(result["reasoning"]).includes("artifact_abc"));
});

test("createDefaultEvaluatorOutput uses generatorOutput artifact in reasoning [harness-loop-support]", () => {
  const input = createMockHarnessLoopInput({ taskId: "task_eval2" });
  const generatorOutput = { artifact: "my_artifact_xyz" };

  const result = createDefaultEvaluatorOutput(input, 3, generatorOutput);

  assert.ok(String(result["reasoning"]).includes("my_artifact_xyz"));
  assert.equal(result["costUsd"], 0.06);
});

test("estimateIterationCost sums costUsd from all outputs [harness-loop-support]", () => {
  const plannerOutput = { costUsd: 0.05 };
  const generatorOutput = { costUsd: 0.1 };
  const evaluatorOutput = { costUsd: 0.02 };

  const result = estimateIterationCost(plannerOutput, generatorOutput, evaluatorOutput);

  assert.equal(result, 0.17);
});

test("estimateIterationCost handles nested cost fields [harness-loop-support]", () => {
  const plannerOutput = { estimatedCostUsd: 0.05 };
  const generatorOutput = { totalCostUsd: 0.1 };
  const evaluatorOutput = { usage: 0.02 };

  const result = estimateIterationCost(plannerOutput, generatorOutput, evaluatorOutput);

  assert.equal(result, 0.17);
});

test("estimateIterationCost returns 0 when no costs specified [harness-loop-support]", () => {
  const plannerOutput = {};
  const generatorOutput = {};
  const evaluatorOutput = {};

  const result = estimateIterationCost(plannerOutput, generatorOutput, evaluatorOutput);

  assert.equal(result, 0);
});

test("estimateIterationCost handles non-finite values gracefully [harness-loop-support]", () => {
  const plannerOutput = { costUsd: Infinity };
  const generatorOutput = { costUsd: NaN };
  const evaluatorOutput = { costUsd: 0.02 };

  const result = estimateIterationCost(plannerOutput, generatorOutput, evaluatorOutput);

  assert.ok(Number.isFinite(result));
});

test("createDefaultPlannerOutput uses domainId in output field [harness-loop-support]", () => {
  const input = createMockHarnessLoopInput({
    taskId: "task_multi",
    domainId: "my_domain",
  });

  const result = createDefaultPlannerOutput(input, 2);

  assert.equal(result.output, "Plan 2 for my_domain");
});
