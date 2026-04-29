import test from "node:test";
import assert from "node:assert/strict";

import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import {
  buildAiOperationsStartupPlan,
  registerAiOperationsStartupPlan,
} from "../../../../src/platform/ai-operations-startup-plan.js";
import {
  buildFivePlaneStartupPlan,
  registerFivePlaneStartupPlan,
} from "../../../../src/platform/five-plane-startup-plan.js";
import {
  buildFivePlaneRuntimeCatalog,
  registerFivePlaneRuntimeCatalog,
} from "../../../../src/platform/five-plane-runtime-bootstrap.js";
import { AiOperationsRuntimeOrchestrator } from "../../../../src/platform/ai-operations-runtime-orchestrator.js";
import { FivePlaneRuntimeOrchestrator } from "../../../../src/platform/five-plane-runtime-orchestrator.js";

test("integration: AI operations startup plan registers and initializes correctly", async () => {
  const registry = new ServiceRegistry();

  registerAiOperationsStartupPlan(registry);
  const plan = registry.get("aiops.runtime.startup-plan");

  assert.ok(plan != null, "AI ops startup plan should be registered");
  assert.equal(plan.steps.length, 4, "should have 4 steps");
  assert.deepStrictEqual(plan.startupOrder, ["model-gateway", "prompt-engine", "compliance", "harness"]);

  await registry.reset();
});

test("integration: Five plane startup plan registers and initializes correctly", async () => {
  const registry = new ServiceRegistry();

  registerFivePlaneStartupPlan(registry);
  const plan = registry.get("plane.runtime.startup-plan");

  assert.ok(plan != null, "five plane startup plan should be registered");
  assert.equal(plan.steps.length, 6, "should have 6 steps");
  assert.deepStrictEqual(
    plan.startupOrder,
    ["interface", "x1-fabric", "control-plane", "orchestration", "execution", "state-evidence"],
  );

  await registry.reset();
});

test("integration: Five plane runtime catalog can be registered and retrieved", async () => {
  const registry = new ServiceRegistry();

  registerFivePlaneRuntimeCatalog(registry);
  const catalog = registry.get("plane.runtime.catalog");

  assert.ok(catalog != null, "runtime catalog should be registered");
  assert.ok(catalog.interfacePlane.length > 0, "interfacePlane should be populated");
  assert.ok(catalog.controlPlane.length > 0, "controlPlane should be populated");

  await registry.reset();
});

test("integration: AiOperationsRuntimeOrchestrator properly orchestrates all services", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  const startupResult = orchestrator.startup();

  assert.equal(startupResult.ready, true, "startup should complete successfully");
  assert.equal(startupResult.steps.length, 4, "should have 4 steps");
  // Should have at least 4 bootstraps initialized
  assert.ok(startupResult.initializedServiceIds.length >= 4, "should have at least 4 initialized service IDs");

  // Verify all capability bootstraps are initialized
  const capabilitySteps = startupResult.steps.filter((s) => s.initialized);
  assert.equal(capabilitySteps.length, 4, "all 4 capability steps should be initialized");

  await registry.reset();
});

test("integration: FivePlaneRuntimeOrchestrator properly orchestrates all planes", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const startupResult = orchestrator.startup();

  assert.equal(startupResult.ready, true, "startup should complete successfully");
  assert.equal(startupResult.steps.length, 6, "should have 6 steps (one per plane)");
  assert.ok(startupResult.runtimeCatalog != null, "runtime catalog should be populated");

  // All planes should be initialized
  const allInitialized = startupResult.steps.every((s) => s.initialized);
  assert.equal(allInitialized, true, "all plane steps should be initialized");

  await registry.reset();
});

test("integration: Both orchestrators can coexist with separate registries", async () => {
  const aiOpsRegistry = new ServiceRegistry();
  const fivePlaneRegistry = new ServiceRegistry();

  const aiOpsOrchestrator = new AiOperationsRuntimeOrchestrator(aiOpsRegistry);
  const fivePlaneOrchestrator = new FivePlaneRuntimeOrchestrator(fivePlaneRegistry);

  const aiOpsResult = aiOpsOrchestrator.startup();
  const fivePlaneResult = fivePlaneOrchestrator.startup();

  assert.equal(aiOpsResult.ready, true, "AI ops startup should succeed");
  assert.equal(fivePlaneResult.ready, true, "five plane startup should succeed");

  // Verify they have independent state
  assert.equal(aiOpsResult.steps.length, 4, "AI ops should have 4 steps");
  assert.equal(fivePlaneResult.steps.length, 6, "five plane should have 6 steps");

  await aiOpsRegistry.reset();
  await fivePlaneRegistry.reset();
});

test("integration: Startup plans can be rebuilt after registry reset", async () => {
  const registry = new ServiceRegistry();

  // First startup
  const aiOpsOrchestrator = new AiOperationsRuntimeOrchestrator(registry);
  const firstStartup = aiOpsOrchestrator.startup();
  assert.equal(firstStartup.ready, true, "first startup should succeed");

  // Reset registry
  await registry.reset();

  // Second startup after reset
  const secondOrchestrator = new AiOperationsRuntimeOrchestrator(registry);
  const secondStartup = secondOrchestrator.startup();
  assert.equal(secondStartup.ready, true, "second startup after reset should succeed");
  assert.equal(secondStartup.steps.length, 4, "should still have 4 steps");
});

test("integration: Five plane startup plan dependency chain is respected", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const result = orchestrator.startup();
  const steps = result.steps;

  // Verify interface is first (no dependencies)
  const interfaceStep = steps.find((s) => s.stepId === "interface");
  assert.equal(interfaceStep?.initializedDependencyServiceIds.length, 0, "interface should have no dependencies");

  // Verify each subsequent plane depends on the previous
  const x1Fabric = steps.find((s) => s.stepId === "x1-fabric");
  assert.ok(x1Fabric?.initializedDependencyServiceIds.includes("plane.interface.bootstrap"), "x1-fabric should depend on interface");

  const controlPlane = steps.find((s) => s.stepId === "control-plane");
  assert.ok(controlPlane?.initializedDependencyServiceIds.includes("plane.x1-fabric.bootstrap"), "control-plane should depend on x1-fabric");

  const orchestration = steps.find((s) => s.stepId === "orchestration");
  assert.ok(orchestration?.initializedDependencyServiceIds.includes("plane.control.bootstrap"), "orchestration should depend on control-plane");

  const execution = steps.find((s) => s.stepId === "execution");
  assert.ok(execution?.initializedDependencyServiceIds.includes("plane.orchestration.bootstrap"), "execution should depend on orchestration");

  const stateEvidence = steps.find((s) => s.stepId === "state-evidence");
  assert.ok(stateEvidence?.initializedDependencyServiceIds.includes("plane.execution.bootstrap"), "state-evidence should depend on execution");

  await registry.reset();
});