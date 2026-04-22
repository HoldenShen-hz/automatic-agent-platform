import assert from "node:assert/strict";
import test from "node:test";

import {
  FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  registerFivePlaneRuntimeOrchestrator,
} from "../../../src/platform/five-plane-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("five-plane runtime orchestrator starts planes in canonical order", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    assert.equal(result.ready, true);
    assert.deepEqual(result.startupOrder, [
      "interface",
      "control-plane",
      "orchestration",
      "execution",
      "state-evidence",
    ]);
    assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
    assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["plane.interface.bootstrap"]);
    assert.equal(result.runtimeCatalog.executionPlane.length, 14);
  } finally {
    await registry.reset();
  }
});

test("five-plane runtime orchestrator exposes readiness snapshots", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
    const beforeStartup = orchestrator.snapshotReadiness();
    assert.equal(beforeStartup.orchestratorInitialized, true);
    assert.equal(beforeStartup.runtimeCatalogInitialized, true);
    assert.equal(beforeStartup.startupPlanInitialized, true);
    assert.equal(beforeStartup.planeReadiness.every((step) => step.initialized), true);

    const afterStartup = orchestrator.startup();
    assert.equal(afterStartup.initializedServiceIds.includes("plane.state-evidence.bootstrap"), true);
    assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
