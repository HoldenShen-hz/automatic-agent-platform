import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeExecuteBridge,
  serialiseOapeflirPlan,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import type { PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { MultiStepOrchestrationResult } from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration-types.js";

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

  const plan = {
    planId: "plan_five_plane",
    taskId: "task_1",
    version: 1,
    assessmentRef: "assessment_1",
    strategy: "linear" as const,
    steps: [createPlanStep()],
    createdAt: Date.now(),
  };

  const result = await bridge.executePlan(plan, { taskId: "task_1", tokenBudget: 512 });

  assert.deepEqual(capturedInput, {
    dbPath: "/tmp/five-plane-runtime-execute-bridge.db",
    title: "OAPEFLIR plan plan_five_plane",
    request: serialiseOapeflirPlan(plan.steps),
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
