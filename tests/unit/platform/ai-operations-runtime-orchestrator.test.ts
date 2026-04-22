import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  registerAiOperationsRuntimeOrchestrator,
} from "../../../src/platform/ai-operations-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("ai operations runtime orchestrator starts W2 capabilities in canonical order", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    assert.equal(result.ready, true);
    assert.deepEqual(result.startupOrder, ["model-gateway", "prompt-engine", "compliance", "harness"]);
    assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
    assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["aiops.model-gateway.bootstrap"]);
  } finally {
    await registry.reset();
  }
});

test("ai operations runtime orchestrator exposes readiness snapshots", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const snapshot = orchestrator.snapshotReadiness();
    assert.equal(snapshot.orchestratorInitialized, true);
    assert.equal(snapshot.runtimeCatalogInitialized, true);
    assert.equal(snapshot.startupPlanInitialized, true);
    assert.equal(snapshot.capabilityReadiness.every((step) => step.initialized), true);
    assert.equal(registry.isInitialized(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
