import assert from "node:assert/strict";
import test from "node:test";

import {
  FivePlaneRuntimeOrchestrator,
  FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  registerFivePlaneRuntimeOrchestrator,
} from "../../../src/platform/five-plane-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("integration: five-plane runtime orchestrator coordinates full plane initialization", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    // Verify all planes initialized in correct order
    assert.equal(result.ready, true);
    assert.deepEqual(result.startupOrder, [
      "interface",
      "x1-fabric",
      "control-plane",
      "orchestration",
      "execution",
      "state-evidence",
    ]);

    // Verify all plane bootstraps are registered
    assert.ok(result.initializedServiceIds.includes("plane.interface.bootstrap"));
    assert.ok(result.initializedServiceIds.includes("plane.x1-fabric.bootstrap"));
    assert.ok(result.initializedServiceIds.includes("plane.control.bootstrap"));
    assert.ok(result.initializedServiceIds.includes("plane.orchestration.bootstrap"));
    assert.ok(result.initializedServiceIds.includes("plane.execution.bootstrap"));
    assert.ok(result.initializedServiceIds.includes("plane.state-evidence.bootstrap"));

    // Verify runtime catalog has all planes
    assert.ok(result.runtimeCatalog.interfacePlane.length > 0);
    assert.ok(result.runtimeCatalog.controlPlane.length > 0);
    assert.ok(result.runtimeCatalog.orchestrationPlane.length > 0);
    assert.ok(result.runtimeCatalog.executionPlane.length > 0);
    assert.ok(result.runtimeCatalog.stateEvidencePlane.length > 0);
  } finally {
    await registry.reset();
  }
});

test("integration: orchestrator startup result has correct step initialization", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.equal(result.steps.length, 6);

    // Interface has no dependencies
    const interfaceStep = result.steps.find((s) => s.stepId === "interface");
    assert.ok(interfaceStep);
    assert.equal(interfaceStep.initialized, true);
    assert.deepEqual(interfaceStep.initializedDependencyServiceIds, []);

    // X1 fabric depends on interface.
    const x1FabricStep = result.steps.find((s) => s.stepId === "x1-fabric");
    assert.ok(x1FabricStep);
    assert.equal(x1FabricStep.initialized, true);
    assert.ok(x1FabricStep.initializedDependencyServiceIds.includes("plane.interface.bootstrap"));

    // Control-plane depends on x1 fabric.
    const controlPlaneStep = result.steps.find((s) => s.stepId === "control-plane");
    assert.ok(controlPlaneStep);
    assert.equal(controlPlaneStep.initialized, true);
    assert.ok(controlPlaneStep.initializedDependencyServiceIds.includes("plane.x1-fabric.bootstrap"));

    // Orchestration depends on control-plane
    const orchestrationStep = result.steps.find((s) => s.stepId === "orchestration");
    assert.ok(orchestrationStep);
    assert.equal(orchestrationStep.initialized, true);
    assert.ok(orchestrationStep.initializedDependencyServiceIds.includes("plane.control.bootstrap"));

    // Execution depends on orchestration
    const executionStep = result.steps.find((s) => s.stepId === "execution");
    assert.ok(executionStep);
    assert.equal(executionStep.initialized, true);
    assert.ok(executionStep.initializedDependencyServiceIds.includes("plane.orchestration.bootstrap"));

    // State-evidence depends on execution
    const stateEvidenceStep = result.steps.find((s) => s.stepId === "state-evidence");
    assert.ok(stateEvidenceStep);
    assert.equal(stateEvidenceStep.initialized, true);
    assert.ok(stateEvidenceStep.initializedDependencyServiceIds.includes("plane.execution.bootstrap"));
  } finally {
    await registry.reset();
  }
});

test("integration: readiness snapshot reflects all planes after initialization", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);

    // Trigger initialization
    orchestrator.startup();

    const snapshot = orchestrator.snapshotReadiness();

    assert.equal(snapshot.runtimeCatalogInitialized, true);
    assert.equal(snapshot.startupPlanInitialized, true);
    assert.equal(snapshot.orchestratorInitialized, true);
    assert.equal(snapshot.planeReadiness.length, 6);

    // All startup steps should be initialized.
    for (const plane of snapshot.planeReadiness) {
      assert.equal(plane.initialized, true, `${plane.stepId} should be initialized`);
    }
  } finally {
    await registry.reset();
  }
});

test("integration: FivePlaneRuntimeOrchestrator constructor accepts custom registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new FivePlaneRuntimeOrchestrator(registry);
    assert.ok(orchestrator);

    const result = orchestrator.startup();
    assert.equal(result.ready, true);
  } finally {
    await registry.reset();
  }
});

test("integration: prepare can be called multiple times", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

    const first = orchestrator.prepare();
    const second = orchestrator.prepare();

    assert.ok(first.startupPlan);
    assert.ok(first.runtimeCatalog);
    assert.ok(second.startupPlan);
    assert.ok(second.runtimeCatalog);
  } finally {
    await registry.reset();
  }
});

test("integration: startup can be called multiple times", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);

    const first = orchestrator.startup();
    const second = orchestrator.startup();

    assert.equal(first.ready, true);
    assert.equal(second.ready, true);
    assert.deepEqual(first.startupOrder, second.startupOrder);
  } finally {
    await registry.reset();
  }
});
