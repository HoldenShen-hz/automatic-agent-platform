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

test("AI operations startup plan integration - builds complete plan", () => {
  const plan = buildAiOperationsStartupPlan();

  assert.ok(plan.steps.length === 4, "plan should have exactly 4 steps");
  assert.ok(plan.totalCapabilityCount > 0, "plan should have capabilities");
  assert.ok(plan.startupOrder.length === 4, "startupOrder should have exactly 4 entries");
});

test("AI operations startup plan integration - step dependency chain is valid", () => {
  const plan = buildAiOperationsStartupPlan();

  const modelGateway = plan.steps.find((s) => s.stepId === "model-gateway");
  const promptEngine = plan.steps.find((s) => s.stepId === "prompt-engine");
  const compliance = plan.steps.find((s) => s.stepId === "compliance");
  const harness = plan.steps.find((s) => s.stepId === "harness");

  assert.ok(modelGateway && modelGateway.dependsOnStepIds.length === 0, "modelGateway has no dependencies");
  assert.ok(promptEngine && promptEngine.dependsOnStepIds.includes("model-gateway"), "promptEngine depends on modelGateway");
  assert.ok(compliance && compliance.dependsOnStepIds.includes("prompt-engine"), "compliance depends on promptEngine");
  assert.ok(harness && harness.dependsOnStepIds.includes("compliance"), "harness depends on compliance");
});

test("AI operations startup plan integration - register and retrieve from registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const plan = registerAiOperationsStartupPlan(registry);
    assert.ok(registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID), "startup plan service should be initialized");
    assert.ok(plan.steps.length === 4, "retrieved plan should have 4 steps");
  } finally {
    await registry.reset();
  }
});

test("AI operations startup plan integration - each step has required fields", () => {
  const plan = buildAiOperationsStartupPlan();

  for (const step of plan.steps) {
    assert.ok(step.stepId, "step should have stepId");
    assert.ok(step.capabilityId, "step should have capabilityId");
    assert.ok(step.entryModule, "step should have entryModule");
    assert.ok(step.bootstrapServiceId, "step should have bootstrapServiceId");
    assert.ok(typeof step.capabilityCount === "number" && step.capabilityCount >= 0, "step should have valid capabilityCount");
    assert.ok(Array.isArray(step.dependsOnStepIds), "step should have dependsOnStepIds array");
  }
});

test("AI operations startup plan integration - startupOrder matches stepIds", () => {
  const plan = buildAiOperationsStartupPlan();

  const orderMatches = plan.startupOrder.every((stepId, index) => plan.steps[index].stepId === stepId);
  assert.ok(orderMatches, "startupOrder should match the order of steps in the plan");
});

test("AI operations startup plan integration - totalCapabilityCount is sum of all steps", () => {
  const plan = buildAiOperationsStartupPlan();

  const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);
  assert.equal(plan.totalCapabilityCount, sum, "totalCapabilityCount should equal sum of all step counts");
});

test("AI operations startup plan integration - service ID constant is correct", () => {
  assert.equal(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID, "aiops.runtime.startup-plan");
});

test("AI operations startup plan integration - startup plan service is initialized after register", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const plan = registerAiOperationsStartupPlan(registry);
    assert.ok(registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID), "startup plan service should be initialized");
    assert.ok(plan.steps.length === 4, "plan should have 4 steps");
  } finally {
    await registry.reset();
  }
});