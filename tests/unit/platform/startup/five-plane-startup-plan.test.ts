import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFivePlaneStartupPlan,
  registerFivePlaneStartupPlan,
  FIVE_PLANE_STARTUP_PLAN_SERVICE_ID,
  type FivePlaneStartupStepId,
} from "../../../../src/platform/five-plane-startup-plan.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("buildFivePlaneStartupPlan returns a valid startup plan", () => {
  const plan = buildFivePlaneStartupPlan();

  assert.ok(Array.isArray(plan.steps), "steps should be an array");
  assert.ok(plan.steps.length > 0, "steps should not be empty");
  assert.equal(plan.totalCapabilityCount > 0, true, "totalCapabilityCount should be positive");
  assert.deepStrictEqual(
    plan.startupOrder,
    ["interface", "x1-fabric", "control-plane", "orchestration", "execution", "state-evidence"],
  );
});

test("FivePlaneStartupPlan has correct step dependencies", () => {
  const plan = buildFivePlaneStartupPlan();

  const interfaceStep = plan.steps.find((s) => s.stepId === "interface");
  assert.ok(interfaceStep, "interface step should exist");
  assert.deepStrictEqual(interfaceStep.dependsOnStepIds, [], "interface has no dependencies");

  const x1FabricStep = plan.steps.find((s) => s.stepId === "x1-fabric");
  assert.ok(x1FabricStep, "x1-fabric step should exist");
  assert.deepStrictEqual(x1FabricStep.dependsOnStepIds, ["interface"], "x1-fabric depends on interface");

  const controlPlaneStep = plan.steps.find((s) => s.stepId === "control-plane");
  assert.ok(controlPlaneStep, "control-plane step should exist");
  assert.deepStrictEqual(controlPlaneStep.dependsOnStepIds, ["x1-fabric"], "control-plane depends on x1-fabric");

  const orchestrationStep = plan.steps.find((s) => s.stepId === "orchestration");
  assert.ok(orchestrationStep, "orchestration step should exist");
  assert.deepStrictEqual(orchestrationStep.dependsOnStepIds, ["control-plane"], "orchestration depends on control-plane");

  const executionStep = plan.steps.find((s) => s.stepId === "execution");
  assert.ok(executionStep, "execution step should exist");
  assert.deepStrictEqual(executionStep.dependsOnStepIds, ["orchestration"], "execution depends on orchestration");

  const stateEvidenceStep = plan.steps.find((s) => s.stepId === "state-evidence");
  assert.ok(stateEvidenceStep, "state-evidence step should exist");
  assert.deepStrictEqual(stateEvidenceStep.dependsOnStepIds, ["execution"], "state-evidence depends on execution");
});

test("FivePlaneStartupPlan stepIds are unique", () => {
  const plan = buildFivePlaneStartupPlan();
  const stepIds = plan.steps.map((s) => s.stepId);
  const uniqueStepIds = new Set(stepIds);
  assert.equal(stepIds.length, uniqueStepIds.size, "All stepIds should be unique");
});

test("FivePlaneStartupPlan startupOrder matches step order", () => {
  const plan = buildFivePlaneStartupPlan();
  assert.equal(plan.startupOrder.length, plan.steps.length, "startupOrder length should match steps length");

  plan.steps.forEach((step, index) => {
    assert.equal(plan.startupOrder[index], step.stepId, `startupOrder[${index}] should match step stepId`);
  });
});

test("registerFivePlaneStartupPlan registers and initializes service", async () => {
  const registry = new ServiceRegistry();

  // registerFivePlaneStartupPlan calls get() internally, so service is initialized after call
  const plan = registerFivePlaneStartupPlan(registry);
  assert.equal(registry.isInitialized(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID), true, "service should be initialized after register()");
  assert.ok(plan != null, "plan should be retrievable");

  await registry.reset();
});

test("FivePlaneStartupPlan totalCapabilityCount is sum of all step capability counts", () => {
  const plan = buildFivePlaneStartupPlan();
  const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);
  assert.equal(plan.totalCapabilityCount, sum, "totalCapabilityCount should equal sum of step capability counts");
});

test("buildFivePlaneStartupPlan step has required properties", () => {
  const plan = buildFivePlaneStartupPlan();

  for (const step of plan.steps) {
    assert.ok(step.stepId, "step should have stepId");
    assert.ok(step.surfaceId, "step should have surfaceId");
    assert.ok(step.entryModule, "step should have entryModule");
    assert.ok(step.bootstrapServiceId, "step should have bootstrapServiceId");
    assert.ok(typeof step.capabilityCount === "number", "capabilityCount should be a number");
    assert.ok(Array.isArray(step.dependsOnStepIds), "dependsOnStepIds should be an array");
  }
});

test("FivePlaneStartupStepId type is one of the expected values", () => {
  const validStepIds: FivePlaneStartupStepId[] = [
    "interface",
    "x1-fabric",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ];
  const plan = buildFivePlaneStartupPlan();

  for (const stepId of plan.startupOrder) {
    assert.ok(validStepIds.includes(stepId), `${stepId} should be a valid FivePlaneStartupStepId`);
  }
});

test("FivePlaneStartupPlan forms a valid dependency chain", () => {
  const plan = buildFivePlaneStartupPlan();

  // Build a map of stepId to step
  const stepMap = new Map(plan.steps.map((s) => [s.stepId, s]));

  // Verify each step's dependencies exist and come before it
  for (const step of plan.steps) {
    const stepIndex = plan.startupOrder.indexOf(step.stepId);

    for (const depId of step.dependsOnStepIds) {
      const depStep = stepMap.get(depId);
      assert.ok(depStep, `Dependency ${depId} should exist`);

      const depIndex = plan.startupOrder.indexOf(depId);
      assert.ok(depIndex < stepIndex, `Dependency ${depId} should come before ${step.stepId} in startupOrder`);
    }
  }
});