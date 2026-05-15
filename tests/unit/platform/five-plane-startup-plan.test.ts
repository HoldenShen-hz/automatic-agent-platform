import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFivePlaneStartupPlan,
  FIVE_PLANE_STARTUP_PLAN_SERVICE_ID,
  registerFivePlaneStartupPlan,
  type FivePlaneStartupStep,
  type FivePlaneStartupStepId,
} from "../../../src/platform/five-plane-startup-plan.js";
import { registerFivePlaneRuntimeCatalog } from "../../../src/platform/five-plane-runtime-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("five-plane startup plan captures the canonical startup order", () => {
  const plan = buildFivePlaneStartupPlan();
  assert.deepEqual(plan.startupOrder, [
    "interface",
    "x1-fabric",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ]);
  assert.equal(plan.totalCapabilityCount, 70);
  assert.equal(plan.steps[3]?.bootstrapServiceId, "plane.orchestration.bootstrap");
});

test("five-plane startup plan registers after plane bootstraps are available", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerFivePlaneRuntimeCatalog(registry);
    const plan = registerFivePlaneStartupPlan(registry);
    assert.equal(plan.steps[0]?.entryModule, "src/platform/five-plane-interface/index.ts");
    assert.equal(plan.steps[5]?.dependsOnStepIds.includes("execution"), true);
    assert.equal(registry.isInitialized(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("buildFivePlaneStartupPlan returns six steps", () => {
  const plan = buildFivePlaneStartupPlan();
  assert.equal(plan.steps.length, 6);
});

test("each step has correct stepId matching its position", () => {
  const plan = buildFivePlaneStartupPlan();
  const expectedStepIds: FivePlaneStartupStepId[] = [
    "interface",
    "x1-fabric",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ];

  plan.steps.forEach((step, index) => {
    assert.equal(step.stepId, expectedStepIds[index]);
  });
});

test("each step has correct surfaceId", () => {
  const plan = buildFivePlaneStartupPlan();
  plan.steps.forEach((step) => {
    assert.equal(step.surfaceId, step.stepId);
  });
});

test("interface step has no dependencies", () => {
  const plan = buildFivePlaneStartupPlan();
  const interfaceStep = plan.steps.find((s) => s.stepId === "interface");
  assert.ok(interfaceStep);
  assert.deepEqual(interfaceStep.dependsOnStepIds, []);
});

test("control-plane step depends on interface", () => {
  const plan = buildFivePlaneStartupPlan();
  const controlPlaneStep = plan.steps.find((s) => s.stepId === "control-plane");
  assert.ok(controlPlaneStep);
  assert.deepEqual(controlPlaneStep.dependsOnStepIds, ["x1-fabric"]);
});

test("x1-fabric step depends on interface", () => {
  const plan = buildFivePlaneStartupPlan();
  const x1Step = plan.steps.find((s) => s.stepId === "x1-fabric");
  assert.ok(x1Step);
  assert.deepEqual(x1Step.dependsOnStepIds, ["interface"]);
});

test("orchestration step depends on control-plane", () => {
  const plan = buildFivePlaneStartupPlan();
  const orchestrationStep = plan.steps.find((s) => s.stepId === "orchestration");
  assert.ok(orchestrationStep);
  assert.deepEqual(orchestrationStep.dependsOnStepIds, ["control-plane"]);
});

test("execution step depends on orchestration", () => {
  const plan = buildFivePlaneStartupPlan();
  const executionStep = plan.steps.find((s) => s.stepId === "execution");
  assert.ok(executionStep);
  assert.deepEqual(executionStep.dependsOnStepIds, ["orchestration"]);
});

test("state-evidence step depends on execution", () => {
  const plan = buildFivePlaneStartupPlan();
  const stateEvidenceStep = plan.steps.find((s) => s.stepId === "state-evidence");
  assert.ok(stateEvidenceStep);
  assert.deepEqual(stateEvidenceStep.dependsOnStepIds, ["execution"]);
});

test("each step has correct bootstrapServiceId", () => {
  const plan = buildFivePlaneStartupPlan();

  assert.equal(plan.steps[0]!.bootstrapServiceId, "plane.interface.bootstrap");
  assert.equal(plan.steps[1]!.bootstrapServiceId, "plane.x1-fabric.bootstrap");
  assert.equal(plan.steps[2]!.bootstrapServiceId, "plane.control.bootstrap");
  assert.equal(plan.steps[3]!.bootstrapServiceId, "plane.orchestration.bootstrap");
  assert.equal(plan.steps[4]!.bootstrapServiceId, "plane.execution.bootstrap");
  assert.equal(plan.steps[5]!.bootstrapServiceId, "plane.state-evidence.bootstrap");
});

test("totalCapabilityCount equals sum of all step capabilityCounts", () => {
  const plan = buildFivePlaneStartupPlan();
  const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);
  assert.equal(plan.totalCapabilityCount, sum);
});

test("startupOrder equals map of stepIds", () => {
  const plan = buildFivePlaneStartupPlan();
  const stepIds = plan.steps.map((step) => step.stepId);
  assert.deepEqual(plan.startupOrder, stepIds);
});

test("registerFivePlaneStartupPlan registers service in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerFivePlaneRuntimeCatalog(registry);
    const plan = registerFivePlaneStartupPlan(registry);
    assert.ok(plan);
    assert.equal(registry.isInitialized(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("steps are readonly arrays", () => {
  const plan = buildFivePlaneStartupPlan();
  assert.ok(Array.isArray(plan.steps));
  assert.ok(Array.isArray(plan.startupOrder));
});

test("FivePlaneStartupStepId type accepts all valid step IDs", () => {
  const validIds: FivePlaneStartupStepId[] = [
    "interface",
    "x1-fabric",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ];
  const plan = buildFivePlaneStartupPlan();
  validIds.forEach((id) => {
    assert.equal(plan.startupOrder.includes(id), true);
  });
});
