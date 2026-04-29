/**
 * Integration Test: Interaction Governance Runtime Orchestrator
 *
 * Tests InteractionGovernanceRuntimeOrchestrator with actual ServiceRegistry integration,
 * including full bootstrap chain for interaction and org-governance capabilities.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import {
  INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  InteractionGovernanceRuntimeOrchestrator,
  registerInteractionGovernanceRuntimeOrchestrator,
  type InteractionGovernanceRuntimeStartupResult,
  type InteractionGovernanceReadinessSnapshot,
} from "../../src/interaction-governance-runtime-orchestrator.js";
import {
  INTERACTION_BOOTSTRAP_SERVICE_ID,
  INTERACTION_CATALOG_SERVICE_ID,
} from "../../src/interaction/interaction-bootstrap.js";
import {
  GOVERNANCE_BOOTSTRAP_SERVICE_ID,
  GOVERNANCE_CATALOG_SERVICE_ID,
} from "../../src/org-governance/governance-bootstrap.js";
import {
  INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID,
} from "../../src/interaction-governance-runtime-catalog.js";
import {
  INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID,
} from "../../src/interaction-governance-startup-plan.js";

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("integration: InteractionGovernanceRuntimeOrchestrator.startup returns complete result structure", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.ok("ready" in result, "result should have ready field");
  assert.ok("startupOrder" in result, "result should have startupOrder field");
  assert.ok("initializedServiceIds" in result, "result should have initializedServiceIds field");
  assert.ok("steps" in result, "result should have steps field");
  assert.ok(Array.isArray(result.steps), "steps should be an array");
});

test("integration: InteractionGovernanceRuntimeOrchestrator.startup produces correct startup sequence", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.deepEqual(result.startupOrder, ["interaction", "org-governance"]);
});

test("integration: InteractionGovernanceRuntimeOrchestrator.startup all steps are initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true);
  for (const step of result.steps) {
    assert.equal(step.initialized, true, `step ${step.stepId} should be initialized`);
  }
});

test("integration: InteractionGovernanceRuntimeOrchestrator.startup interaction step has no dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const interactionStep = result.steps.find((s) => s.stepId === "interaction")!;
  assert.equal(interactionStep.stepId, "interaction");
  assert.deepEqual(interactionStep.initializedDependencyServiceIds, []);
});

test("integration: InteractionGovernanceRuntimeOrchestrator.startup org-governance step depends on interaction", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const governanceStep = result.steps.find((s) => s.stepId === "org-governance")!;
  assert.equal(governanceStep.stepId, "org-governance");
  assert.deepEqual(governanceStep.initializedDependencyServiceIds, [INTERACTION_BOOTSTRAP_SERVICE_ID]);
});

test("integration: InteractionGovernanceRuntimeOrchestrator.startup initializedServiceIds contains both bootstraps", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.ok(result.initializedServiceIds.includes(INTERACTION_BOOTSTRAP_SERVICE_ID));
  assert.ok(result.initializedServiceIds.includes(GOVERNANCE_BOOTSTRAP_SERVICE_ID));
});

test("integration: InteractionGovernanceRuntimeOrchestrator.snapshotReadiness returns complete snapshot", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  assert.ok("runtimeCatalogInitialized" in snapshot);
  assert.ok("startupPlanInitialized" in snapshot);
  assert.ok("orchestratorInitialized" in snapshot);
  assert.ok("capabilityReadiness" in snapshot);
  assert.ok(Array.isArray(snapshot.capabilityReadiness));
});

test("integration: InteractionGovernanceRuntimeOrchestrator.snapshotReadiness all capabilities ready after startup", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  assert.equal(snapshot.runtimeCatalogInitialized, true);
  assert.equal(snapshot.startupPlanInitialized, true);
  for (const capability of snapshot.capabilityReadiness) {
    assert.equal(capability.initialized, true, `${capability.stepId} should be initialized`);
  }
});

test("integration: InteractionGovernanceRuntimeOrchestrator.snapshotReadiness capabilityReadiness has both steps", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  const stepIds = snapshot.capabilityReadiness.map((c) => c.stepId);
  assert.ok(stepIds.includes("interaction"));
  assert.ok(stepIds.includes("org-governance"));
});

test("integration: registerInteractionGovernanceRuntimeOrchestrator registers orchestrator service", async () => {
  const registry = ServiceRegistry.getInstance();
  registerInteractionGovernanceRuntimeOrchestrator(registry);

  assert.ok(registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID));
});

test("integration: registerInteractionGovernanceRuntimeOrchestrator returns orchestrator instance", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);

  assert.ok(orchestrator instanceof InteractionGovernanceRuntimeOrchestrator);
});

test("integration: registerInteractionGovernanceRuntimeOrchestrator startup produces correct result", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true);
  assert.deepEqual(result.startupOrder, ["interaction", "org-governance"]);
  assert.equal(result.steps.length, 2);
});

test("integration: registerInteractionGovernanceRuntimeOrchestrator startup step dependencies are correct", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const interactionStep = result.steps.find((s) => s.stepId === "interaction")!;
  const governanceStep = result.steps.find((s) => s.stepId === "org-governance")!;

  assert.deepEqual(interactionStep.initializedDependencyServiceIds, []);
  assert.deepEqual(governanceStep.initializedDependencyServiceIds, [INTERACTION_BOOTSTRAP_SERVICE_ID]);
});

test("integration: orchestrator depends on interaction, governance, catalog, and startup-plan services", async () => {
  const registry = ServiceRegistry.getInstance();
  registerInteractionGovernanceRuntimeOrchestrator(registry);
  registry.get(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID);

  assert.ok(registry.isInitialized(INTERACTION_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(GOVERNANCE_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID));
  assert.ok(registry.isInitialized(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID));
});

test("integration: InteractionGovernanceRuntimeOrchestrator.prepare returns plan with correct steps", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  assert.ok(plan.steps.length > 0);
  assert.deepEqual(plan.startupOrder, ["interaction", "org-governance"]);
  for (const step of plan.steps) {
    assert.ok("stepId" in step);
    assert.ok("bootstrapServiceId" in step);
    assert.ok("capabilityCount" in step);
    assert.ok("dependsOnStepIds" in step);
  }
});

test("integration: InteractionGovernanceRuntimeOrchestrator.prepare registers both bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  orchestrator.prepare();

  assert.ok(registry.isInitialized(INTERACTION_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(GOVERNANCE_BOOTSTRAP_SERVICE_ID));
});

test("integration: startup result steps have correct structure and data", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  for (const step of result.steps) {
    assert.ok("stepId" in step);
    assert.ok("bootstrapServiceId" in step);
    assert.ok("capabilityCount" in step);
    assert.ok("initialized" in step);
    assert.ok("initializedDependencyServiceIds" in step);
    assert.ok(typeof step.stepId === "string");
    assert.ok(typeof step.bootstrapServiceId === "string");
    assert.ok(typeof step.capabilityCount === "number");
    assert.ok(typeof step.initialized === "boolean");
    assert.ok(Array.isArray(step.initializedDependencyServiceIds));
  }
});

test("integration: InteractionGovernanceRuntimeOrchestrator can be instantiated without arguments", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new InteractionGovernanceRuntimeOrchestrator();
  assert.ok(orchestrator instanceof InteractionGovernanceRuntimeOrchestrator);

  const result = orchestrator.startup();
  assert.equal(result.ready, true);
});

test("integration: multiple startups maintain consistent state", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);

  const result1 = orchestrator.startup();
  const result2 = orchestrator.startup();

  assert.deepEqual(result1.startupOrder, result2.startupOrder);
  assert.equal(result1.ready, result2.ready);
  assert.equal(result1.steps.length, result2.steps.length);
});

test("integration: InteractionGovernanceRuntimeOrchestrator startup result matches expected interface", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  // Verify the result conforms to InteractionGovernanceRuntimeStartupResult
  assert.strictEqual(typeof result.ready, "boolean");
  assert.ok(Array.isArray(result.startupOrder));
  assert.ok(Array.isArray(result.initializedServiceIds));
  assert.ok(Array.isArray(result.steps));

  // Verify startupOrder contains expected step IDs
  for (const stepId of result.startupOrder) {
    assert.ok(stepId === "interaction" || stepId === "org-governance");
  }
});

test("integration: InteractionGovernanceRuntimeOrchestrator readiness snapshot matches expected interface", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  // Verify the snapshot conforms to InteractionGovernanceReadinessSnapshot
  assert.strictEqual(typeof snapshot.runtimeCatalogInitialized, "boolean");
  assert.strictEqual(typeof snapshot.startupPlanInitialized, "boolean");
  assert.strictEqual(typeof snapshot.orchestratorInitialized, "boolean");
  assert.ok(Array.isArray(snapshot.capabilityReadiness));

  // Verify capability readiness entries
  for (const capability of snapshot.capabilityReadiness) {
    assert.ok("stepId" in capability);
    assert.ok("bootstrapServiceId" in capability);
    assert.ok("initialized" in capability);
  }
});