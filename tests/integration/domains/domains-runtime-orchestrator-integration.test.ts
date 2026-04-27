/**
 * Integration Test: Domains Runtime Orchestrator
 *
 * Tests the full lifecycle of DomainsRuntimeOrchestrator including
 * registration, startup sequence, dependency management, and
 * readiness snapshots with actual ServiceRegistry integration.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  DomainsRuntimeOrchestrator,
  registerDomainsRuntimeOrchestrator,
  type DomainsRuntimeStartupResult,
  type DomainsReadinessSnapshot,
} from "../../../src/domains-runtime-orchestrator.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  DomainsRuntimeCatalog,
} from "../../../src/domains-runtime-catalog.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAINS_CATALOG_SERVICE_ID,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
} from "../../../src/domains/domains-bootstrap.js";
import {
  DOMAINS_STARTUP_PLAN_SERVICE_ID,
  type DomainsStartupPlan,
} from "../../../src/domains-startup-plan.js";

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("integration: DomainsRuntimeOrchestrator registers all services in correct order", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);

  // Verify orchestrator is registered
  assert.ok(
    registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID),
    "orchestrator should be registered",
  );

  // Verify bootstrap services are registered
  assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID), "bootstrap should be registered");
  assert.ok(registry.isInitialized(DOMAINS_CATALOG_SERVICE_ID), "catalog should be registered");

  // Verify all phase bootstrap services are registered
  for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"] as const) {
    assert.ok(
      registry.isInitialized(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
      `Phase ${phase} bootstrap should be registered`,
    );
  }

  // Verify runtime catalog and startup plan are registered
  assert.ok(
    registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID),
    "runtime catalog should be registered",
  );
  assert.ok(
    registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID),
    "startup plan should be registered",
  );

  // Verify orchestrator instance
  const retrieved = registry.get<DomainsRuntimeOrchestrator>(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
  assert.ok(retrieved instanceof DomainsRuntimeOrchestrator);
});

test("integration: DomainsRuntimeOrchestrator startup produces correct phase order", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true, "startup should be ready");
  assert.deepEqual(
    result.startupOrder,
    ["9a", "9b", "9c", "9d", "9e", "9f"],
    "startup order should follow phase sequence",
  );
});

test("integration: DomainsRuntimeOrchestrator startup initializes all phase services", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  // All phase bootstrap services should be initialized
  for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"] as const) {
    assert.ok(
      result.initializedServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
      `Phase ${phase} should be initialized`,
    );
  }
});

test("integration: DomainsRuntimeOrchestrator startup steps reflect correct dependency chain", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  // First step (9a) has no dependencies
  const step9a = result.steps.find((s) => s.stepId === "9a")!;
  assert.deepEqual(step9a.initializedDependencyServiceIds, [], "9a should have no dependencies");

  // Second step (9b) depends on 9a
  const step9b = result.steps.find((s) => s.stepId === "9b")!;
  assert.deepEqual(step9b.initializedDependencyServiceIds, [DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9a"]]);

  // Third step (9c) depends on 9b
  const step9c = result.steps.find((s) => s.stepId === "9c")!;
  assert.deepEqual(step9c.initializedDependencyServiceIds, [DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9b"]]);
});

test("integration: DomainsRuntimeOrchestrator snapshotReadiness captures all phases", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  assert.equal(snapshot.orchestratorInitialized, true, "orchestrator should be initialized");
  assert.equal(snapshot.runtimeCatalogInitialized, true, "runtime catalog should be initialized");
  assert.equal(snapshot.startupPlanInitialized, true, "startup plan should be initialized");

  // All phases should be captured
  const phases = snapshot.capabilityReadiness.map((c) => c.stepId);
  assert.ok(phases.includes("9a"), "should include phase 9a");
  assert.ok(phases.includes("9b"), "should include phase 9b");
  assert.ok(phases.includes("9c"), "should include phase 9c");
  assert.ok(phases.includes("9d"), "should include phase 9d");
  assert.ok(phases.includes("9e"), "should include phase 9e");
  assert.ok(phases.includes("9f"), "should include phase 9f");
});

test("integration: DomainsRuntimeOrchestrator can be instantiated with custom registry", async () => {
  const registry = ServiceRegistry.getInstance();

  // Use constructor directly with custom registry
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  assert.ok(plan.steps.length > 0, "prepare should return a valid plan");
});

test("integration: DomainsRuntimeOrchestrator prepare returns correct plan structure", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  assert.ok("steps" in plan, "plan should have steps");
  assert.ok("totalCapabilityCount" in plan, "plan should have totalCapabilityCount");
  assert.ok("startupOrder" in plan, "plan should have startupOrder");

  assert.equal(plan.steps.length, 6, "should have 6 steps");
  assert.equal(plan.totalCapabilityCount, 31, "should have 31 total capabilities");
});

test("integration: DomainsRuntimeOrchestrator startup result has correct structure", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
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

test("integration: Full startup flow bootstrap, catalog, plan, orchestrator", async () => {
  const registry = ServiceRegistry.getInstance();

  // Step 1: Register and start orchestrator (which registers all dependencies)
  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true);
  assert.equal(result.steps.length, 6);

  // Verify all services are initialized
  assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(DOMAINS_CATALOG_SERVICE_ID));
  assert.ok(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID));
  assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));
  assert.ok(registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID));
});

test("integration: DomainsRuntimeOrchestrator startup can be called multiple times safely", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);

  const result1 = orchestrator.startup();
  const result2 = orchestrator.startup();

  // Both should return successful results
  assert.equal(result1.ready, true);
  assert.equal(result2.ready, true);

  // Both should have the same startup order
  assert.deepEqual(result1.startupOrder, result2.startupOrder);
});

test("integration: DomainsRuntimeCatalog is accessible after orchestrator startup", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  orchestrator.startup();

  const catalog = registry.get<DomainsRuntimeCatalog>(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);

  // Verify catalog has all phases
  assert.ok(catalog.phase9a.length > 0, "phase9a should have baselines");
  assert.ok(catalog.phase9b.length > 0, "phase9b should have baselines");
  assert.ok(catalog.phase9c.length > 0, "phase9c should have baselines");
  assert.ok(catalog.phase9d.length > 0, "phase9d should have baselines");
  assert.ok(catalog.phase9e.length > 0, "phase9e should have baselines");
  assert.ok(catalog.phase9f.length > 0, "phase9f should have baselines");
});
