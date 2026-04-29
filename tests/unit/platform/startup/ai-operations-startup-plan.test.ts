import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAiOperationsStartupPlan,
  registerAiOperationsStartupPlan,
  AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID,
  type AiOperationsStartupStepId,
} from "../../../../src/platform/ai-operations-startup-plan.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("buildAiOperationsStartupPlan returns a valid startup plan", () => {
  const plan = buildAiOperationsStartupPlan();

  assert.ok(Array.isArray(plan.steps), "steps should be an array");
  assert.ok(plan.steps.length > 0, "steps should not be empty");
  assert.equal(plan.totalCapabilityCount > 0, true, "totalCapabilityCount should be positive");
  assert.deepStrictEqual(plan.startupOrder, ["model-gateway", "prompt-engine", "compliance", "harness"]);
});

test("AiOperationsStartupPlan has correct step dependencies", () => {
  const plan = buildAiOperationsStartupPlan();

  const modelGatewayStep = plan.steps.find((s) => s.stepId === "model-gateway");
  assert.ok(modelGatewayStep, "model-gateway step should exist");
  assert.deepStrictEqual(modelGatewayStep.dependsOnStepIds, [], "model-gateway has no dependencies");

  const promptEngineStep = plan.steps.find((s) => s.stepId === "prompt-engine");
  assert.ok(promptEngineStep, "prompt-engine step should exist");
  assert.deepStrictEqual(promptEngineStep.dependsOnStepIds, ["model-gateway"], "prompt-engine depends on model-gateway");

  const complianceStep = plan.steps.find((s) => s.stepId === "compliance");
  assert.ok(complianceStep, "compliance step should exist");
  assert.deepStrictEqual(complianceStep.dependsOnStepIds, ["prompt-engine"], "compliance depends on prompt-engine");

  const harnessStep = plan.steps.find((s) => s.stepId === "harness");
  assert.ok(harnessStep, "harness step should exist");
  assert.deepStrictEqual(harnessStep.dependsOnStepIds, ["compliance"], "harness depends on compliance");
});

test("AiOperationsStartupPlan stepIds are unique", () => {
  const plan = buildAiOperationsStartupPlan();
  const stepIds = plan.steps.map((s) => s.stepId);
  const uniqueStepIds = new Set(stepIds);
  assert.equal(stepIds.length, uniqueStepIds.size, "All stepIds should be unique");
});

test("AiOperationsStartupPlan startupOrder matches step order", () => {
  const plan = buildAiOperationsStartupPlan();
  assert.equal(plan.startupOrder.length, plan.steps.length, "startupOrder length should match steps length");

  plan.steps.forEach((step, index) => {
    assert.equal(plan.startupOrder[index], step.stepId, `startupOrder[${index}] should match step stepId`);
  });
});

test("registerAiOperationsStartupPlan registers and initializes service", async () => {
  const registry = new ServiceRegistry();

  // registerAiOperationsStartupPlan calls get() internally, so service is initialized after call
  const plan = registerAiOperationsStartupPlan(registry);
  assert.equal(registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID), true, "service should be initialized after register()");
  assert.ok(plan != null, "plan should be retrievable");

  await registry.reset();
});

test("AiOperationsStartupPlan totalCapabilityCount is sum of all step capability counts", () => {
  const plan = buildAiOperationsStartupPlan();
  const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);
  assert.equal(plan.totalCapabilityCount, sum, "totalCapabilityCount should equal sum of step capability counts");
});

test("buildAiOperationsStartupPlan step has required properties", () => {
  const plan = buildAiOperationsStartupPlan();

  for (const step of plan.steps) {
    assert.ok(step.stepId, "step should have stepId");
    assert.ok(step.capabilityId, "step should have capabilityId");
    assert.ok(step.entryModule, "step should have entryModule");
    assert.ok(step.bootstrapServiceId, "step should have bootstrapServiceId");
    assert.ok(typeof step.capabilityCount === "number", "capabilityCount should be a number");
    assert.ok(Array.isArray(step.dependsOnStepIds), "dependsOnStepIds should be an array");
  }
});

test("AiOperationsStartupStepId type is one of the expected values", () => {
  const validStepIds: AiOperationsStartupStepId[] = ["model-gateway", "prompt-engine", "compliance", "harness"];
  const plan = buildAiOperationsStartupPlan();

  for (const stepId of plan.startupOrder) {
    assert.ok(validStepIds.includes(stepId), `${stepId} should be a valid AiOperationsStartupStepId`);
  }
});