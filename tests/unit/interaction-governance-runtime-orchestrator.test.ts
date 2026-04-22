import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  registerInteractionGovernanceRuntimeOrchestrator,
} from "../../src/interaction-governance-runtime-orchestrator.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("interaction-governance runtime orchestrator starts W3 capabilities in canonical order", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    assert.equal(result.ready, true);
    assert.deepEqual(result.startupOrder, ["interaction", "org-governance"]);
    assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
    assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["w3.interaction.bootstrap"]);
  } finally {
    await registry.reset();
  }
});

test("interaction-governance runtime orchestrator exposes readiness snapshots", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
    const snapshot = orchestrator.snapshotReadiness();
    assert.equal(snapshot.orchestratorInitialized, true);
    assert.equal(snapshot.runtimeCatalogInitialized, true);
    assert.equal(snapshot.startupPlanInitialized, true);
    assert.equal(snapshot.capabilityReadiness.every((step) => step.initialized), true);
    assert.equal(registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
