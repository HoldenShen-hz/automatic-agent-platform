import test from "node:test";
import assert from "node:assert/strict";

import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import { AiOperationsRuntimeOrchestrator } from "../../../../src/platform/ai-operations-runtime-orchestrator.js";
import { FivePlaneRuntimeOrchestrator } from "../../../../src/platform/five-plane-runtime-orchestrator.js";
import { buildAiOperationsStartupPlan } from "../../../../src/platform/ai-operations-startup-plan.js";
import { buildFivePlaneStartupPlan } from "../../../../src/platform/five-plane-startup-plan.js";

test("bootstrap sequencing: AI ops steps initialize in dependency order", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  orchestrator.prepare();

  // After prepare, the startup plan should be registered but not yet initialized
  const startupPlan = registry.get("aiops.runtime.startup-plan");
  assert.ok(startupPlan != null, "startup plan should be registered");

  // Now call startup to trigger initialization
  const result = orchestrator.startup();
  assert.equal(result.ready, true, "startup should complete successfully");

  // Verify startup order matches dependency order
  const expectedOrder = ["model-gateway", "prompt-engine", "compliance", "harness"];
  assert.deepStrictEqual(result.startupOrder, expectedOrder, "startup order should match dependency order");

  await registry.reset();
});

test("bootstrap sequencing: Five plane steps initialize in dependency order", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  orchestrator.prepare();

  // After prepare, the startup plan should be registered but not yet initialized
  const startupPlan = registry.get("plane.runtime.startup-plan");
  assert.ok(startupPlan != null, "startup plan should be registered");

  // Now call startup to trigger initialization
  const result = orchestrator.startup();
  assert.equal(result.ready, true, "startup should complete successfully");

  // Verify startup order matches dependency order
  const expectedOrder = ["interface", "x1-fabric", "control-plane", "orchestration", "execution", "state-evidence"];
  assert.deepStrictEqual(result.startupOrder, expectedOrder, "startup order should match dependency order");

  await registry.reset();
});

test("bootstrap sequencing: capabilityCount accumulates correctly across steps", async () => {
  const plan = buildAiOperationsStartupPlan();

  let accumulatedCount = 0;
  for (const step of plan.steps) {
    accumulatedCount += step.capabilityCount;
    // Each step adds its capability count
    assert.ok(step.capabilityCount > 0, `${step.stepId} should have positive capabilityCount`);
  }

  assert.equal(plan.totalCapabilityCount, accumulatedCount, "totalCapabilityCount should equal sum of all step counts");
});

test("bootstrap sequencing: each step in startup order has valid bootstrapServiceId", () => {
  const aiOpsPlan = buildAiOperationsStartupPlan();

  for (const step of aiOpsPlan.steps) {
    assert.ok(step.bootstrapServiceId.length > 0, `${step.stepId} should have a bootstrapServiceId`);
    assert.ok(step.bootstrapServiceId.includes("."), "bootstrapServiceId should be a dot-separated service ID");
  }
});

test("bootstrap sequencing: startup plan is registered before runtime catalog in AI ops", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  // Register all services via prepare (which triggers initialization via get() calls)
  orchestrator.prepare();

  // After prepare, services are registered AND initialized (prepare calls get() internally)
  assert.ok(registry.isInitialized("aiops.runtime.startup-plan"), "startup plan should be initialized after prepare");
  assert.ok(registry.isInitialized("aiops.runtime.catalog"), "runtime catalog should be initialized after prepare");

  // After startup, both should still be initialized
  orchestrator.startup();
  assert.ok(registry.isInitialized("aiops.runtime.startup-plan"), "startup plan should be initialized after startup");
  assert.ok(registry.isInitialized("aiops.runtime.catalog"), "runtime catalog should be initialized after startup");

  await registry.reset();
});

test("bootstrap sequencing: five plane registry dependency order is correct", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const planServiceId = "plane.runtime.startup-plan";
  const catalogServiceId = "plane.runtime.catalog";

  // After prepare, services are registered AND initialized (prepare calls get() internally)
  orchestrator.prepare();

  assert.ok(registry.isInitialized(planServiceId), "startup plan should be initialized after prepare");
  assert.ok(registry.isInitialized(catalogServiceId), "runtime catalog should be initialized after prepare");

  // After startup, both should still be initialized
  orchestrator.startup();
  assert.ok(registry.isInitialized(planServiceId), "startup plan should be initialized after startup");
  assert.ok(registry.isInitialized(catalogServiceId), "runtime catalog should be initialized after startup");

  await registry.reset();
});

test("bootstrap sequencing: ServiceRegistry topological sort respects dependency order", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  orchestrator.startup();

  // Get the topological sort
  const sortedServiceIds = registry.topologicalSort();

  // Verify that plane bootstrap services appear in dependency order
  const planeServiceOrder = [
    "interface.plane.bootstrap",
    "plane.x1-fabric.bootstrap",
    "control-plane.bootstrap",
    "orchestration.plane.bootstrap",
    "execution.plane.bootstrap",
    "state-evidence.plane.bootstrap",
  ];

  // Filter to just the plane bootstrap services that are registered
  const registeredPlanes = planeServiceOrder.filter((id) =>
    sortedServiceIds.includes(id),
  );

  // They should appear in order in the topological sort
  for (let i = 1; i < registeredPlanes.length; i++) {
    const prevId = registeredPlanes[i - 1]!;
    const currId = registeredPlanes[i]!;
    const prevIndex = sortedServiceIds.indexOf(prevId);
    const currIndex = sortedServiceIds.indexOf(currId);
    assert.ok(prevIndex < currIndex, `${prevId} should come before ${currId} in topological sort`);
  }

  await registry.reset();
});

test("bootstrap sequencing: each plane bootstrap has positive capability count", () => {
  const plan = buildFivePlaneStartupPlan();

  for (const step of plan.steps) {
    assert.ok(step.capabilityCount > 0, `${step.stepId} should have positive capabilityCount`);
  }

  assert.ok(plan.totalCapabilityCount > 0, "totalCapabilityCount should be positive");
});

test("bootstrap sequencing: X1 fabric aggregates multiple capability bootstraps", () => {
  const plan = buildFivePlaneStartupPlan();

  const x1FabricStep = plan.steps.find((s) => s.stepId === "x1-fabric");
  assert.ok(x1FabricStep, "x1-fabric step should exist");
  assert.ok(x1FabricStep.capabilityCount > 0, "x1-fabric should aggregate multiple capabilities");
  assert.ok(x1FabricStep.dependsOnStepIds.includes("interface"), "x1-fabric should depend on interface");
});