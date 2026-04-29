import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID,
  buildAiOperationsStartupPlan,
  registerAiOperationsStartupPlan,
  type AiOperationsStartupPlan,
  type AiOperationsStartupStep,
  type AiOperationsStartupStepId,
} from "../../../../src/platform/ai-operations-startup-plan.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("buildAiOperationsStartupPlan returns plan with steps", () => {
  const plan = buildAiOperationsStartupPlan();
  assert.ok(plan.steps, "plan should have steps");
  assert.ok(Array.isArray(plan.steps), "steps should be array");
  assert.ok(plan.steps.length > 0, "steps should not be empty");
});

test("AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID is defined correctly", () => {
  assert.equal(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID, "aiops.runtime.startup-plan");
});

test("startup plan contains all four startup steps", () => {
  const plan = buildAiOperationsStartupPlan();
  const stepIds = plan.steps.map((step) => step.stepId);
  assert.ok(stepIds.includes("model-gateway"), "should include model-gateway step");
  assert.ok(stepIds.includes("prompt-engine"), "should include prompt-engine step");
  assert.ok(stepIds.includes("compliance"), "should include compliance step");
  assert.ok(stepIds.includes("harness"), "should include harness step");
});

test("startup steps have correct structure", () => {
  const plan = buildAiOperationsStartupPlan();
  for (const step of plan.steps) {
    assert.ok("stepId" in step, "step should have stepId");
    assert.ok("capabilityId" in step, "step should have capabilityId");
    assert.ok("entryModule" in step, "step should have entryModule");
    assert.ok("bootstrapServiceId" in step, "step should have bootstrapServiceId");
    assert.ok("capabilityCount" in step, "step should have capabilityCount");
    assert.ok("dependsOnStepIds" in step, "step should have dependsOnStepIds");
    assert.equal(typeof step.stepId, "string");
    assert.equal(typeof step.capabilityCount, "number");
    assert.ok(Array.isArray(step.dependsOnStepIds));
  }
});

test("startup plan has totalCapabilityCount", () => {
  const plan = buildAiOperationsStartupPlan();
  assert.equal(typeof plan.totalCapabilityCount, "number");
  assert.ok(plan.totalCapabilityCount >= 0, "totalCapabilityCount should be non-negative");
});

test("startup plan has startupOrder", () => {
  const plan = buildAiOperationsStartupPlan();
  assert.ok(plan.startupOrder, "plan should have startupOrder");
  assert.ok(Array.isArray(plan.startupOrder), "startupOrder should be array");
  assert.equal(plan.startupOrder.length, plan.steps.length, "startupOrder should match steps count");
});

test("startup steps are in correct dependency order", () => {
  const plan = buildAiOperationsStartupPlan();
  const modelGateway = plan.steps.find((s) => s.stepId === "model-gateway");
  const promptEngine = plan.steps.find((s) => s.stepId === "prompt-engine");
  const compliance = plan.steps.find((s) => s.stepId === "compliance");
  const harness = plan.steps.find((s) => s.stepId === "harness");

  assert.ok(modelGateway, "modelGateway step should exist");
  assert.ok(promptEngine, "promptEngine step should exist");
  assert.ok(compliance, "compliance step should exist");
  assert.ok(harness, "harness step should exist");

  assert.deepStrictEqual(modelGateway.dependsOnStepIds, [], "modelGateway should have no dependencies");
  assert.deepStrictEqual(promptEngine.dependsOnStepIds, ["model-gateway"], "promptEngine depends on modelGateway");
  assert.deepStrictEqual(compliance.dependsOnStepIds, ["prompt-engine"], "compliance depends on promptEngine");
  assert.deepStrictEqual(harness.dependsOnStepIds, ["compliance"], "harness depends on compliance");
});

test("registerAiOperationsStartupPlan registers plan in service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const plan = registerAiOperationsStartupPlan(registry);
    assert.equal(registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID), true);
    assert.ok(plan.steps, "plan should have steps");
  } finally {
    await registry.reset();
  }
});

test("totalCapabilityCount equals sum of step capability counts", () => {
  const plan = buildAiOperationsStartupPlan();
  const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);
  assert.equal(plan.totalCapabilityCount, sum, "totalCapabilityCount should equal sum of all step counts");
});