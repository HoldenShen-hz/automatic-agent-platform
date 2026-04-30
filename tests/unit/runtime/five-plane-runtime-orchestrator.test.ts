/**
 * Unit Tests: Five-Plane Runtime Orchestrator
 *
 * Tests for the FivePlaneRuntimeOrchestrator which manages the startup
 * and orchestration of the five-plane runtime architecture.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { FivePlaneRuntimeOrchestrator } from "../../../../src/platform/five-plane-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

test("FivePlaneRuntimeOrchestrator can be instantiated", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  assert.ok(orchestrator instanceof FivePlaneRuntimeOrchestrator);
});

test("FivePlaneRuntimeOrchestrator accepts custom registry", () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new FivePlaneRuntimeOrchestrator(registry);
  assert.ok(orchestrator instanceof FivePlaneRuntimeOrchestrator);
});

// ---------------------------------------------------------------------------
// FivePlaneRuntimeOrchestrator.prepare()
// ---------------------------------------------------------------------------

test("prepare returns startupPlan and runtimeCatalog", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const { startupPlan, runtimeCatalog } = orchestrator.prepare();

  assert.ok(startupPlan);
  assert.ok(Array.isArray(startupPlan.steps));
  assert.ok(startupPlan.startupOrder);
  assert.ok(typeof startupPlan.totalCapabilityCount === "number");

  assert.ok(runtimeCatalog);
  assert.ok(Array.isArray(runtimeCatalog.interfacePlane));
  assert.ok(Array.isArray(runtimeCatalog.controlPlane));
  assert.ok(Array.isArray(runtimeCatalog.orchestrationPlane));
  assert.ok(Array.isArray(runtimeCatalog.executionPlane));
  assert.ok(Array.isArray(runtimeCatalog.stateEvidencePlane));
});

test("prepare registers all five planes in startupPlan", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const { startupPlan } = orchestrator.prepare();

  const stepIds = startupPlan.steps.map((step) => step.stepId);

  assert.ok(stepIds.includes("interface"));
  assert.ok(stepIds.includes("x1-fabric"));
  assert.ok(stepIds.includes("control-plane"));
  assert.ok(stepIds.includes("orchestration"));
  assert.ok(stepIds.includes("execution"));
  assert.ok(stepIds.includes("state-evidence"));
});

test("prepare registers planes in correct dependency order", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const { startupPlan } = orchestrator.prepare();

  const stepIds = startupPlan.startupOrder;

  // Verify dependency ordering: interface -> x1-fabric -> control-plane -> orchestration -> execution -> state-evidence
  const interfaceIdx = stepIds.indexOf("interface");
  const x1FabricIdx = stepIds.indexOf("x1-fabric");
  const controlPlaneIdx = stepIds.indexOf("control-plane");
  const orchestrationIdx = stepIds.indexOf("orchestration");
  const executionIdx = stepIds.indexOf("execution");
  const stateEvidenceIdx = stepIds.indexOf("state-evidence");

  assert.ok(interfaceIdx < x1FabricIdx, "interface should come before x1-fabric");
  assert.ok(x1FabricIdx < controlPlaneIdx, "x1-fabric should come before control-plane");
  assert.ok(controlPlaneIdx < orchestrationIdx, "control-plane should come before orchestration");
  assert.ok(orchestrationIdx < executionIdx, "orchestration should come before execution");
  assert.ok(executionIdx < stateEvidenceIdx, "execution should come before state-evidence");
});

test("prepare registers steps with correct bootstrapServiceId", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const { startupPlan } = orchestrator.prepare();

  const stepMap = new Map(startupPlan.steps.map((s) => [s.stepId, s]));

  const interfaceStep = stepMap.get("interface");
  assert.ok(interfaceStep);
  assert.ok(interfaceStep.bootstrapServiceId.includes("interface"));

  const x1FabricStep = stepMap.get("x1-fabric");
  assert.ok(x1FabricStep);
  assert.ok(x1FabricStep.bootstrapServiceId.includes("x1-fabric"));

  const controlPlaneStep = stepMap.get("control-plane");
  assert.ok(controlPlaneStep);
  assert.ok(controlPlaneStep.bootstrapServiceId.includes("control-plane"));
});

test("prepare calculates totalCapabilityCount correctly", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const { startupPlan } = orchestrator.prepare();

  const sum = startupPlan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);
  assert.equal(startupPlan.totalCapabilityCount, sum);
});

// ---------------------------------------------------------------------------
// FivePlaneRuntimeOrchestrator.startup()
// ---------------------------------------------------------------------------

test("startup returns FivePlaneRuntimeStartupResult", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const result = orchestrator.startup();

  assert.ok(typeof result.ready === "boolean");
  assert.ok(Array.isArray(result.startupOrder));
  assert.ok(Array.isArray(result.initializedServiceIds));
  assert.ok(Array.isArray(result.steps));
  assert.ok(result.runtimeCatalog);
});

test("startup returns steps with correct structure", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const result = orchestrator.startup();

  for (const step of result.steps) {
    assert.ok(step.stepId);
    assert.ok(step.bootstrapServiceId);
    assert.ok(typeof step.capabilityCount === "number");
    assert.ok(typeof step.initialized === "boolean");
    assert.ok(Array.isArray(step.initializedDependencyServiceIds));
  }
});

test("startup reports correct initialized status for registered services", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const result = orchestrator.startup();

  // All steps should be in initializedServiceIds if initialized
  for (const step of result.steps) {
    if (step.initialized) {
      assert.ok(result.initializedServiceIds.includes(step.bootstrapServiceId));
    }
  }
});

// ---------------------------------------------------------------------------
// FivePlaneRuntimeOrchestrator.snapshotReadiness()
// ---------------------------------------------------------------------------

test("snapshotReadiness returns FivePlaneRuntimeReadinessSnapshot", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const snapshot = orchestrator.snapshotReadiness();

  assert.ok(typeof snapshot.runtimeCatalogInitialized === "boolean");
  assert.ok(typeof snapshot.startupPlanInitialized === "boolean");
  assert.ok(typeof snapshot.orchestratorInitialized === "boolean");
  assert.ok(Array.isArray(snapshot.planeReadiness));
});

test("snapshotReadiness includes all planes in planeReadiness", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const snapshot = orchestrator.snapshotReadiness();

  const planeStepIds = snapshot.planeReadiness.map((p) => p.stepId);

  assert.ok(planeStepIds.includes("interface"));
  assert.ok(planeStepIds.includes("x1-fabric"));
  assert.ok(planeStepIds.includes("control-plane"));
  assert.ok(planeStepIds.includes("orchestration"));
  assert.ok(planeStepIds.includes("execution"));
  assert.ok(planeStepIds.includes("state-evidence"));
});

test("snapshotReadiness planeReadiness entries have correct structure", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const snapshot = orchestrator.snapshotReadiness();

  for (const plane of snapshot.planeReadiness) {
    assert.ok(plane.stepId);
    assert.ok(plane.bootstrapServiceId);
    assert.ok(typeof plane.initialized === "boolean");
  }
});

// ---------------------------------------------------------------------------
// Dependency Resolution
// ---------------------------------------------------------------------------

test("prepare resolves correct dependency service IDs for each step", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const { startupPlan } = orchestrator.prepare();

  // x1-fabric depends on interface
  const x1FabricStep = startupPlan.steps.find((s) => s.stepId === "x1-fabric");
  assert.ok(x1FabricStep);
  assert.ok(x1FabricStep.dependsOnStepIds.includes("interface"));

  // control-plane depends on x1-fabric
  const controlPlaneStep = startupPlan.steps.find((s) => s.stepId === "control-plane");
  assert.ok(controlPlaneStep);
  assert.ok(controlPlaneStep.dependsOnStepIds.includes("x1-fabric"));

  // orchestration depends on control-plane
  const orchestrationStep = startupPlan.steps.find((s) => s.stepId === "orchestration");
  assert.ok(orchestrationStep);
  assert.ok(orchestrationStep.dependsOnStepIds.includes("control-plane"));

  // execution depends on orchestration
  const executionStep = startupPlan.steps.find((s) => s.stepId === "execution");
  assert.ok(executionStep);
  assert.ok(executionStep.dependsOnStepIds.includes("orchestration"));

  // state-evidence depends on execution
  const stateEvidenceStep = startupPlan.steps.find((s) => s.stepId === "state-evidence");
  assert.ok(stateEvidenceStep);
  assert.ok(stateEvidenceStep.dependsOnStepIds.includes("execution"));
});

// ---------------------------------------------------------------------------
// FivePlaneRuntimeStartupStep structure
// ---------------------------------------------------------------------------

test("startupOrder matches step order in startupPlan", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const { startupPlan } = orchestrator.prepare();
  const result = orchestrator.startup();

  assert.deepEqual(result.startupOrder, startupPlan.startupOrder);
});

test("steps contain bootstrapServiceIds for all planes", () => {
  const orchestrator = new FivePlaneRuntimeOrchestrator();
  const result = orchestrator.startup();

  const bootstrapServiceIds = result.steps.map((s) => s.bootstrapServiceId);

  // Each plane should have a unique bootstrap service ID
  const uniqueIds = new Set(bootstrapServiceIds);
  assert.equal(uniqueIds.size, bootstrapServiceIds.length);
});
