import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeExecuteBridge,
  serialiseOapeflirPlan,
  mapStepOutputRecord,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import type { PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { MultiStepOrchestrationResult } from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration-types.js";
import { createPlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

function createPlanStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    stepId: "step_1",
    action: "test_action",
    inputs: {},
    outputs: undefined,
    dependencies: [],
    status: "pending",
    timeout: 30_000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    ...overrides,
  };
}

function planStepToPlanNode(step: PlanStep) {
  return {
    nodeId: step.stepId,
    nodeType: step.action as import("../../../../../src/platform/contracts/executable-contracts/index.js").PlanNodeType,
    inputRefs: step.dependencies ?? [],
    outputSchemaRef: "schema:step.output",
    riskClass: "medium" as import("../../../../../src/platform/contracts/executable-contracts/index.js").RiskClass,
    budgetIntent: { amount: 0.01, currency: "USD" as const, resourceKinds: ["token", "compute"] as const },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: step.retryPolicy ? `retry:${step.retryPolicy.maxRetries}` : "retry:default",
    timeoutMs: step.timeout,
  };
}

test("integration: five-plane RuntimeExecuteBridge delegates execution through injected execution-plane adapter", async () => {
  let capturedInput:
    | {
        dbPath: string;
        title: string;
        request: string;
        contextBudgetTokens?: number;
      }
    | undefined;

  const bridge = new RuntimeExecuteBridge(
    "/tmp/five-plane-runtime-execute-bridge.db",
    "MiniMax-M2.7",
    async (input) => {
      capturedInput = input;
      return {
        snapshot: {
          executionRecord: {
            stepOutputs: [
              {
                id: "sor-five-plane-1",
                stepId: "step_1",
                taskId: "task_1",
                roleId: "general_executor",
                status: "succeeded",
                dataJson: '{"channel":"five-plane"}',
                artifactsJson: '["evidence.json"]',
                summary: "Five-plane runtime completed",
                durationMs: 40,
                tokenCost: 90,
                validationJson: '{"valid":true}',
                producedAt: "2026-04-29T00:00:00.000Z",
              },
            ],
          },
        },
      } as unknown as MultiStepOrchestrationResult;
    },
  );

  const steps = [createPlanStep()];
  const nodes = steps.map(planStepToPlanNode);
  const planBundle = createPlanGraphBundle({
    planGraphBundleId: "plan_five_plane",
    harnessRunId: "harness_run_1",
    graph: {
      graphId: newId("graph"),
      nodes,
      edges: [],
      entryNodeIds: nodes.map((n) => n.nodeId),
      terminalNodeIds: nodes.map((n) => n.nodeId),
      joinStrategy: "all",
      graphHash: newId("hash"),
    },
    schedulerPolicy: {
      policyId: "scheduler:oapeflir.default",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget:plan_five_plane",
    riskProfile: {
      riskClass: "medium",
      reasons: ["test_plan"],
    },
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  });

  const result = await bridge.executePlan(planBundle, { taskId: "task_1", tokenBudget: 512 });

  assert.deepEqual(capturedInput, {
    dbPath: "/tmp/five-plane-runtime-execute-bridge.db",
    title: "OAPEFLIR plan plan_five_plane",
    request: serialiseOapeflirPlan(planBundle.graph.nodes),
    contextBudgetTokens: 512,
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]!.summary, "Five-plane runtime completed");
  assert.deepEqual(result.results[0]!.outputs, { channel: "five-plane" });
});

test("integration: five-plane RuntimeExecuteBridge executeStep reuses the injected execution-plane adapter", async () => {
  let capturedRequest: string | undefined;

  const bridge = new RuntimeExecuteBridge(
    "/tmp/five-plane-runtime-execute-step.db",
    "MiniMax-M2.7",
    async (input) => {
      capturedRequest = input.request;
      return {
        snapshot: {
          executionRecord: {
            stepOutputs: [
              {
                id: "sor-five-plane-step",
                stepId: "step_single",
                taskId: "task_step",
                roleId: "general_executor",
                status: "succeeded",
                dataJson: '{"ok":true}',
                artifactsJson: null,
                summary: "Single step completed",
                durationMs: 25,
                tokenCost: 30,
                validationJson: null,
                producedAt: "2026-04-29T00:00:00.000Z",
              },
            ],
          },
        },
      } as unknown as MultiStepOrchestrationResult;
    },
  );

  const result = await bridge.executeStep(
    createPlanStep({ stepId: "step_single", action: "single_action" }),
    { taskId: "task_step" },
  );

  assert.ok(capturedRequest?.startsWith("oapeflir://plan "));
  assert.equal(result.stepId, "step_single");
  assert.equal(result.summary, "Single step completed");
});

test("mapStepOutputRecord derives validationPassed from validationJson.valid", () => {
  const passed = mapStepOutputRecord({
    id: "sor-pass",
    stepId: "step_pass",
    taskId: "task_pass",
    roleId: "general_executor",
    status: "succeeded",
    dataJson: "{}",
    artifactsJson: null,
    summary: "passed",
    durationMs: 1,
    tokenCost: 1,
    validationJson: "{\"valid\":true}",
    producedAt: "2026-04-29T00:00:00.000Z",
  });
  const failed = mapStepOutputRecord({
    id: "sor-fail",
    stepId: "step_fail",
    taskId: "task_fail",
    roleId: "general_executor",
    status: "failed",
    dataJson: "{}",
    artifactsJson: null,
    summary: "failed",
    durationMs: 1,
    tokenCost: 1,
    validationJson: "{\"valid\":false}",
    producedAt: "2026-04-29T00:00:00.000Z",
  });
  const invalid = mapStepOutputRecord({
    id: "sor-invalid",
    stepId: "step_invalid",
    taskId: "task_invalid",
    roleId: "general_executor",
    status: "failed",
    dataJson: "{}",
    artifactsJson: null,
    summary: "invalid",
    durationMs: 1,
    tokenCost: 1,
    validationJson: "{bad-json}",
    producedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(passed.validationPassed, true);
  assert.equal(failed.validationPassed, false);
  assert.equal(invalid.validationPassed, false);
});
