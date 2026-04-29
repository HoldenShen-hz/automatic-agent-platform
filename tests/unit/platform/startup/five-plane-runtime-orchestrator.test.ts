import test from "node:test";
import assert from "node:assert/strict";

import {
  FivePlaneRuntimeOrchestrator,
  registerFivePlaneRuntimeOrchestrator,
  FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  type FivePlaneStartupExecutionStep,
  type FivePlaneRuntimeStartupResult,
  type FivePlaneRuntimeReadinessSnapshot,
} from "../../../../src/platform/five-plane-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("FivePlaneRuntimeOrchestrator can be instantiated", () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  assert.ok(orchestrator != null, "orchestrator should be created");
});

test("FivePlaneRuntimeOrchestrator.prepare returns startup plan and runtime catalog", () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const result = orchestrator.prepare();

  assert.ok(result != null, "prepare should return a result");
  assert.ok(result.startupPlan != null, "should have startupPlan");
  assert.ok(result.runtimeCatalog != null, "should have runtimeCatalog");
  assert.equal(result.startupPlan.steps.length, 6, "should have 6 startup steps");
});

test("FivePlaneRuntimeOrchestrator.startup returns startup result", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  assert.ok(result != null, "startup should return a result");
  assert.equal(typeof result.ready, "boolean", "ready should be a boolean");
  assert.ok(Array.isArray(result.startupOrder), "startupOrder should be an array");
  assert.ok(Array.isArray(result.initializedServiceIds), "initializedServiceIds should be an array");
  assert.ok(Array.isArray(result.steps), "steps should be an array");
  assert.ok(result.runtimeCatalog != null, "runtimeCatalog should be present");

  await registry.reset();
});

test("FivePlaneRuntimeOrchestrator.startup includes all plane step IDs in order", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  assert.deepStrictEqual(
    result.startupOrder,
    ["interface", "x1-fabric", "control-plane", "orchestration", "execution", "state-evidence"],
  );

  await registry.reset();
});

test("FivePlaneRuntimeOrchestrator.startup marks all steps as initialized after startup", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  for (const step of result.steps as FivePlaneStartupExecutionStep[]) {
    assert.equal(step.initialized, true, `step ${step.stepId} should be initialized`);
  }

  await registry.reset();
});

test("FivePlaneRuntimeOrchestrator.snapshotReadiness returns readiness snapshot", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  // Prepare first (registers services)
  orchestrator.prepare();

  const snapshot = orchestrator.snapshotReadiness();

  assert.ok(snapshot != null, "snapshot should not be null");
  assert.equal(typeof snapshot.runtimeCatalogInitialized, "boolean", "runtimeCatalogInitialized should be boolean");
  assert.equal(typeof snapshot.startupPlanInitialized, "boolean", "startupPlanInitialized should be boolean");
  assert.equal(typeof snapshot.orchestratorInitialized, "boolean", "orchestratorInitialized should be boolean");
  assert.ok(Array.isArray(snapshot.planeReadiness), "planeReadiness should be an array");
  assert.equal(snapshot.planeReadiness.length, 6, "should have 6 plane readiness entries");

  await registry.reset();
});

test("FivePlaneRuntimeOrchestrator steps have correct dependency chain", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  const interfaceStep = (result.steps as FivePlaneStartupExecutionStep[]).find((s) => s.stepId === "interface");
  const x1Fabric = (result.steps as FivePlaneStartupExecutionStep[]).find((s) => s.stepId === "x1-fabric");
  const controlPlane = (result.steps as FivePlaneStartupExecutionStep[]).find((s) => s.stepId === "control-plane");
  const orchestration = (result.steps as FivePlaneStartupExecutionStep[]).find((s) => s.stepId === "orchestration");
  const execution = (result.steps as FivePlaneStartupExecutionStep[]).find((s) => s.stepId === "execution");
  const stateEvidence = (result.steps as FivePlaneStartupExecutionStep[]).find((s) => s.stepId === "state-evidence");

  assert.equal(interfaceStep?.initializedDependencyServiceIds.length, 0, "interface has no dependencies");
  // Service IDs use "plane.<surface>.bootstrap" format
  assert.deepStrictEqual(x1Fabric?.initializedDependencyServiceIds, ["plane.interface.bootstrap"], "x1-fabric depends on interface");
  assert.deepStrictEqual(controlPlane?.initializedDependencyServiceIds, ["plane.x1-fabric.bootstrap"], "control-plane depends on x1-fabric");
  assert.deepStrictEqual(orchestration?.initializedDependencyServiceIds, ["plane.control.bootstrap"], "orchestration depends on control-plane");
  assert.deepStrictEqual(execution?.initializedDependencyServiceIds, ["plane.orchestration.bootstrap"], "execution depends on orchestration");
  assert.deepStrictEqual(stateEvidence?.initializedDependencyServiceIds, ["plane.execution.bootstrap"], "state-evidence depends on execution");

  await registry.reset();
});

test("registerFivePlaneRuntimeOrchestrator registers orchestrator in registry", async () => {
  const registry = new ServiceRegistry();

  // Before registering, orchestrator should not be initialized
  assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID), false, "orchestrator should not be initialized before register");

  const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);

  assert.ok(orchestrator != null, "orchestrator should be registered");

  // After registration, orchestrator should be initialized (register calls get internally)
  assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID), true, "orchestrator should be initialized after register");

  await registry.reset();
});

test("FivePlaneRuntimeStartupResult.ready is true when all steps initialize", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  assert.equal(result.ready, true, "all steps should be ready after startup");

  await registry.reset();
});

test("FivePlaneRuntimeStartupResult.runtimeCatalog contains all planes", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  assert.ok(result.runtimeCatalog.interfacePlane.length > 0, "interfacePlane should have entries");
  assert.ok(result.runtimeCatalog.controlPlane.length > 0, "controlPlane should have entries");
  assert.ok(result.runtimeCatalog.orchestrationPlane.length > 0, "orchestrationPlane should have entries");
  assert.ok(result.runtimeCatalog.executionPlane.length > 0, "executionPlane should have entries");
  assert.ok(result.runtimeCatalog.stateEvidencePlane.length > 0, "stateEvidencePlane should have entries");

  await registry.reset();
});