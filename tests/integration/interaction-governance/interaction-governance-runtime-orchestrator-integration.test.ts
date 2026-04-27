/**
 * Integration Test: Interaction Governance Runtime Orchestrator
 *
 * Tests the full lifecycle of InteractionGovernanceRuntimeOrchestrator including
 * registration, startup sequence, dependency management, and readiness snapshots
 * with actual ServiceRegistry integration.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  InteractionGovernanceRuntimeOrchestrator,
  registerInteractionGovernanceRuntimeOrchestrator,
  type InteractionGovernanceRuntimeStartupResult,
  type InteractionGovernanceReadinessSnapshot,
} from "../../../src/interaction-governance-runtime-orchestrator.js";
import {
  INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID,
} from "../../../src/interaction-governance-runtime-catalog.js";
import {
  INTERACTION_BOOTSTRAP_SERVICE_ID,
} from "../../../src/interaction/interaction-bootstrap.js";
import {
  GOVERNANCE_BOOTSTRAP_SERVICE_ID,
} from "../../../src/org-governance/governance-bootstrap.js";
import {
  INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID,
} from "../../../src/interaction-governance-startup-plan.js";

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("integration: InteractionGovernanceRuntimeOrchestrator registers all services", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);

  // Verify orchestrator is registered
  assert.ok(
    registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID),
    "orchestrator should be registered",
  );

  // Verify bootstrap services are registered
  assert.ok(registry.isInitialized(INTERACTION_BOOTSTRAP_SERVICE_ID), "interaction bootstrap should be registered");
  assert.ok(registry.isInitialized(GOVERNANCE_BOOTSTRAP_SERVICE_ID), "governance bootstrap should be registered");

  // Verify runtime catalog and startup plan are registered
  assert.ok(
    registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID),
    "runtime catalog should be registered",
  );
  assert.ok(
    registry.isInitialized(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID),
    "startup plan should be registered",
  );

  // Verify orchestrator instance
  const retrieved = registry.get<InteractionGovernanceRuntimeOrchestrator>(
    INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  );
  assert.ok(retrieved instanceof InteractionGovernanceRuntimeOrchestrator);
});

test("integration: InteractionGovernanceRuntimeOrchestrator startup returns correct phase order", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true, "startup should be ready");
  assert.deepEqual(
    result.startupOrder,
    ["interaction", "org-governance"],
    "startup order should follow phase sequence",
  );
});

test("integration: InteractionGovernanceRuntimeOrchestrator startup initializes all services", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true);
  assert.ok(result.initializedServiceIds.length > 0);
});

test("integration: InteractionGovernanceRuntimeOrchestrator first step has no dependencies", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const firstStep = result.steps[0]!;
  assert.deepEqual(firstStep.initializedDependencyServiceIds, [], "first step should have no dependencies");
});

test("integration: InteractionGovernanceRuntimeOrchestrator second step depends on first", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const secondStep = result.steps[1]!;
  assert.ok(secondStep.initializedDependencyServiceIds.length > 0, "second step should have dependencies");
});

test("integration: InteractionGovernanceRuntimeOrchestrator snapshotReadiness captures all phases", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  assert.equal(snapshot.orchestratorInitialized, true, "orchestrator should be initialized");
  assert.equal(snapshot.runtimeCatalogInitialized, true, "runtime catalog should be initialized");
  assert.equal(snapshot.startupPlanInitialized, true, "startup plan should be initialized");

  // All phases should be captured
  const phases = snapshot.capabilityReadiness.map((c) => c.stepId);
  assert.ok(phases.includes("interaction"), "should include phase interaction");
  assert.ok(phases.includes("org-governance"), "should include phase org-governance");
});

test("integration: InteractionGovernanceRuntimeOrchestrator can be instantiated with custom registry", async () => {
  const registry = ServiceRegistry.getInstance();

  // Use constructor directly with custom registry
  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  assert.ok(plan.steps.length > 0, "prepare should return a valid plan");
});

test("integration: InteractionGovernanceRuntimeOrchestrator prepare returns correct plan structure", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new InteractionGovernanceRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  assert.ok("steps" in plan, "plan should have steps");
  assert.ok("startupOrder" in plan, "plan should have startupOrder");

  assert.equal(plan.steps.length, 2, "should have 2 steps");
});

test("integration: InteractionGovernanceRuntimeOrchestrator startup result has correct structure", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  // Verify result structure
  assert.ok("ready" in result);
  assert.ok("startupOrder" in result);
  assert.ok("initializedServiceIds" in result);
  assert.ok("steps" in result);

  // Verify steps structure
  for (const step of result.steps) {
    assert.ok("stepId" in step);
    assert.ok("bootstrapServiceId" in step);
    assert.ok("capabilityCount" in step);
    assert.ok("initialized" in step);
    assert.ok("initializedDependencyServiceIds" in step);
  }
});

test("integration: InteractionGovernanceRuntimeOrchestrator startup can be called multiple times safely", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);

  const result1 = orchestrator.startup();
  const result2 = orchestrator.startup();

  // Both should return successful results
  assert.equal(result1.ready, true);
  assert.equal(result2.ready, true);

  // Both should have the same startup order
  assert.deepEqual(result1.startupOrder, result2.startupOrder);
});

test("integration: Full startup flow for interaction-governance", async () => {
  const registry = ServiceRegistry.getInstance();

  // Step 1: Register orchestrator (which registers all dependencies)
  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true);
  assert.equal(result.steps.length, 2);

  // Verify all services are initialized
  assert.ok(registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID));
  assert.ok(registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID));
  assert.ok(registry.isInitialized(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID));
  assert.ok(registry.isInitialized(INTERACTION_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(GOVERNANCE_BOOTSTRAP_SERVICE_ID));
});

test("integration: InteractionGovernanceRuntimeOrchestrator dependency chain is correct", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerInteractionGovernanceRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  // Verify dependency chain
  const interactionStep = result.steps.find((s) => s.stepId === "interaction")!;
  assert.deepEqual(interactionStep.initializedDependencyServiceIds, [], "interaction step has no dependencies");

  const orgGovernanceStep = result.steps.find((s) => s.stepId === "org-governance")!;
  assert.ok(orgGovernanceStep.initializedDependencyServiceIds.length > 0, "org-governance step has dependencies");
});
