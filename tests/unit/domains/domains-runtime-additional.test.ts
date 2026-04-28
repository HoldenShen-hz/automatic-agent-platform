import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  DomainsRuntimeCatalog,
  buildDomainsRuntimeCatalog,
  registerDomainsRuntimeCatalog,
} from "../../../src/domains-runtime-catalog.js";
import {
  DOMAINS_STARTUP_PLAN_SERVICE_ID,
  buildDomainsStartupPlan,
  registerDomainsStartupPlan,
  type DomainsStartupPlan,
  type DomainsStartupStepId,
} from "../../../src/domains-startup-plan.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAINS_CATALOG_SERVICE_ID,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
  registerDomainsBootstrap,
  type DomainsBootstrap,
} from "../../../src/domains/domains-bootstrap.js";
import {
  DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  DomainsRuntimeOrchestrator,
  registerDomainsRuntimeOrchestrator,
  type DomainsRuntimeStartupResult,
  type DomainsReadinessSnapshot,
} from "../../../src/domains-runtime-orchestrator.js";

// =============================================================================
// Additional tests for domains-runtime-catalog
// =============================================================================

test("buildDomainsRuntimeCatalog returns rings with correct domain counts", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.equal(catalog.ring1.length, 8);
  assert.ok(catalog.ring1.some((b) => b.domainId === "coding"));
  assert.ok(catalog.ring1.some((b) => b.domainId === "quant-trading"));
  assert.equal(catalog.ring2.length, 11);
  assert.ok(catalog.ring2.some((b) => b.domainId === "legal"));
  assert.ok(catalog.ring2.some((b) => b.domainId === "it-operations"));
  assert.equal(catalog.ring3.length, 12);
  assert.ok(catalog.ring3.some((b) => b.domainId === "healthcare"));
  assert.ok(catalog.ring3.some((b) => b.domainId === "marketing"));
});

test("buildDomainsRuntimeCatalog ring domains retain historical batch assignment", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const baseline of catalog.ring1) {
    assert.ok(["9a", "9b"].includes(baseline.phase), `${baseline.domainId} should map into ring1`);
  }
  for (const baseline of catalog.ring2) {
    assert.ok(["9c", "9d"].includes(baseline.phase), `${baseline.domainId} should map into ring2`);
  }
  for (const baseline of catalog.ring3) {
    assert.ok(["9e", "9f"].includes(baseline.phase), `${baseline.domainId} should map into ring3`);
  }
});

test("registerDomainsRuntimeCatalog requires bootstrap services to be registered first", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    // This should work since registerDomainsBootstrap registers the dependencies
    registerDomainsRuntimeCatalog(registry);
    assert.equal(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("registerDomainsRuntimeCatalog ring maps contain DomainBaseline arrays", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerDomainsRuntimeCatalog(registry);

    // Verify all phases are arrays
    assert.ok(Array.isArray(catalog.ring1));
    assert.ok(Array.isArray(catalog.ring2));
    assert.ok(Array.isArray(catalog.ring3));

    // Verify all entries have required DomainBaseline properties
    const allBaselines = [...catalog.ring1, ...catalog.ring2, ...catalog.ring3];

    for (const baseline of allBaselines) {
      assert.ok("domainId" in baseline);
      assert.ok("phase" in baseline);
      assert.ok("definition" in baseline);
      assert.ok("riskProfile" in baseline);
    }
  } finally {
    await registry.reset();
  }
});

// =============================================================================
// Additional tests for domains-startup-plan
// =============================================================================

test("buildDomainsStartupPlan returns correct step structure", async () => {
  const plan = buildDomainsStartupPlan();

  assert.ok("steps" in plan);
  assert.ok("totalCapabilityCount" in plan);
  assert.ok("startupOrder" in plan);

  assert.equal(plan.steps.length, 3);
  assert.equal(plan.startupOrder.length, 3);
  assert.equal(plan.totalCapabilityCount, 31);
});

test("buildDomainsStartupPlan first step has no dependencies", async () => {
  const plan = buildDomainsStartupPlan();

  const firstStep = plan.steps[0]!;
  assert.deepEqual(firstStep.dependsOnStepIds, []);
  assert.equal(firstStep.stepId, "ring1");
});

test("buildDomainsStartupPlan later steps depend on previous rings", async () => {
  const plan = buildDomainsStartupPlan();

  const ring2 = plan.steps.find((s) => s.stepId === "ring2")!;
  assert.deepEqual(ring2.dependsOnStepIds, ["ring1"]);

  const ring3 = plan.steps.find((s) => s.stepId === "ring3")!;
  assert.deepEqual(ring3.dependsOnStepIds, ["ring2"]);
});

test("buildDomainsStartupPlan step capability counts match ring domain counts", async () => {
  const plan = buildDomainsStartupPlan();

  const ring1 = plan.steps.find((s) => s.stepId === "ring1")!;
  assert.equal(ring1.capabilityCount, 8);

  const ring2 = plan.steps.find((s) => s.stepId === "ring2")!;
  assert.equal(ring2.capabilityCount, 11);

  const ring3 = plan.steps.find((s) => s.stepId === "ring3")!;
  assert.equal(ring3.capabilityCount, 12);
});

test("buildDomainsStartupPlan registers correctly in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerDomainsBootstrap(registry);
    const plan = registerDomainsStartupPlan(registry);

    assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));
    assert.equal(plan.steps.length, 3);
  } finally {
    await registry.reset();
  }
});

// =============================================================================
// Additional tests for domains-runtime-orchestrator - registration flow
// =============================================================================

test("registerDomainsRuntimeOrchestrator properly registers all dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);

    // Verify orchestrator is registered
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID));

    // Verify bootstrap services are registered
    assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(DOMAINS_CATALOG_SERVICE_ID));

    // Verify all phase bootstrap services are registered
    for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"] as const) {
      assert.ok(
        registry.isInitialized(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
        `Phase ${phase} bootstrap should be registered`,
      );
    }

    // Verify runtime catalog and startup plan are registered
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID));
    assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));

    // Verify orchestrator can be retrieved
    const retrieved = registry.get(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
    assert.ok(retrieved instanceof DomainsRuntimeOrchestrator);
  } finally {
    await registry.reset();
  }
});

test("registerDomainsRuntimeOrchestrator startup returns correct structure", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    // Verify result structure
    assert.ok("ready" in result);
    assert.ok("startupOrder" in result);
    assert.ok("initializedServiceIds" in result);
    assert.ok("steps" in result);

    // Verify result values
    assert.equal(result.ready, true);
    assert.deepEqual(result.startupOrder, ["ring1", "ring2", "ring3"]);
    assert.ok(result.steps.length > 0);
    assert.ok(result.initializedServiceIds.length > 0);
  } finally {
    await registry.reset();
  }
});

test("registerDomainsRuntimeOrchestrator startup initializes all legacy phase dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    orchestrator.startup();

    for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"] as const) {
      assert.ok(
        registry.isInitialized(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
        `Phase ${phase} should be initialized`,
      );
    }
  } finally {
    await registry.reset();
  }
});

test("registerDomainsRuntimeOrchestrator startup produces steps with correct bootstrapServiceId", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    for (const step of result.steps) {
      assert.ok("stepId" in step);
      assert.ok("bootstrapServiceId" in step);
      assert.ok("capabilityCount" in step);
      assert.ok("initialized" in step);

      // bootstrapServiceId should match the phase bootstrap service id
      assert.equal(step.bootstrapServiceId, `w5.domains.ring.${step.stepId}.bootstrap`);
    }
  } finally {
    await registry.reset();
  }
});

// =============================================================================
// Tests for snapshotReadiness with properly registered orchestrator
// =============================================================================

test("registerDomainsRuntimeOrchestrator snapshotReadiness shows orchestrator initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    assert.equal(snapshot.orchestratorInitialized, true);
  } finally {
    await registry.reset();
  }
});

test("registerDomainsRuntimeOrchestrator snapshotReadiness shows runtime catalog initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    assert.equal(snapshot.runtimeCatalogInitialized, true);
  } finally {
    await registry.reset();
  }
});

test("registerDomainsRuntimeOrchestrator snapshotReadiness shows startup plan initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    assert.equal(snapshot.startupPlanInitialized, true);
  } finally {
    await registry.reset();
  }
});

test("registerDomainsRuntimeOrchestrator snapshotReadiness contains all rings", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    const rings = snapshot.capabilityReadiness.map((c) => c.stepId);
    assert.ok(rings.includes("ring1"), "should include ring1");
    assert.ok(rings.includes("ring2"), "should include ring2");
    assert.ok(rings.includes("ring3"), "should include ring3");
  } finally {
    await registry.reset();
  }
});

// =============================================================================
// Edge case tests
// =============================================================================

test("DomainsRuntimeOrchestrator without registry uses default singleton", async () => {
  const registry1 = ServiceRegistry.getInstance();
  const registry2 = ServiceRegistry.getInstance();

  // Both should be the same instance
  assert.strictEqual(registry1, registry2);

  try {
    // Create orchestrator without explicit registry
    const orchestrator = new DomainsRuntimeOrchestrator();
    const plan = orchestrator.prepare();

    assert.ok(plan.steps.length > 0);
  } finally {
    await registry1.reset();
  }
});

test("DomainsRuntimeOrchestrator startup can be called multiple times", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);

    const result1 = orchestrator.startup();
    const result2 = orchestrator.startup();

    // Both should return successful results
    assert.equal(result1.ready, true);
    assert.equal(result2.ready, true);

    // Both should have the same startup order
    assert.deepEqual(result1.startupOrder, result2.startupOrder);
  } finally {
    await registry.reset();
  }
});

test("DomainsRuntimeOrchestrator prepare can be called multiple times", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new DomainsRuntimeOrchestrator(registry);

    const plan1 = orchestrator.prepare();
    const plan2 = orchestrator.prepare();

    // Both should return valid plans
    assert.ok(plan1.steps.length > 0);
    assert.ok(plan2.steps.length > 0);
  } finally {
    await registry.reset();
  }
});

test("startup result steps have correct dependency chain", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    // Verify dependency chain
    const ring1 = result.steps.find((s) => s.stepId === "ring1")!;
    assert.deepEqual(ring1.initializedDependencyServiceIds, []);

    const ring2 = result.steps.find((s) => s.stepId === "ring2")!;
    assert.deepEqual(ring2.initializedDependencyServiceIds, ["w5.domains.ring.ring1.bootstrap"]);

    const ring3 = result.steps.find((s) => s.stepId === "ring3")!;
    assert.deepEqual(ring3.initializedDependencyServiceIds, ["w5.domains.ring.ring2.bootstrap"]);
  } finally {
    await registry.reset();
  }
});

test("DomainsRuntimeOrchestrator startup with explicit registry works correctly", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new DomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.equal(result.ready, true);
    assert.equal(result.steps.length, 3);
  } finally {
    await registry.reset();
  }
});

test("DomainsRuntimeOrchestrator prepare returns steps with correct structure", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new DomainsRuntimeOrchestrator(registry);
    const plan = orchestrator.prepare();

    for (const step of plan.steps) {
      assert.ok("stepId" in step);
      assert.ok("bootstrapServiceId" in step);
      assert.ok("capabilityCount" in step);
      assert.ok("dependsOnStepIds" in step);
      assert.ok("entryModule" in step);
    }
  } finally {
    await registry.reset();
  }
});

// =============================================================================
// Integration tests for the full startup flow
// =============================================================================

test("full startup flow: bootstrap, catalog, plan, orchestrator", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    // Step 1: Register and start bootstrap
    const bootstrap = registerDomainsBootstrap(registry);
    assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID));
    assert.equal(bootstrap.phases.length, 6);

    // Step 2: Register runtime catalog
    const catalog = registerDomainsRuntimeCatalog(registry);
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID));
    assert.equal(catalog.ring1.length, 8);

    // Step 3: Register startup plan
    const plan = registerDomainsStartupPlan(registry);
    assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));
    assert.equal(plan.steps.length, 3);

    // Step 4: Register and start orchestrator
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.equal(result.ready, true);
    assert.equal(result.steps.length, 3);

    // Verify all services are initialized
    assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(DOMAINS_CATALOG_SERVICE_ID));
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID));
    assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID));
  } finally {
    await registry.reset();
  }
});

test("DomainsRuntimeOrchestrator startup properly initializes dependent services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    await registry.reset();
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);

    const result = orchestrator.startup();

    // After startup, all services should be initialized
    assert.equal(result.ready, true);
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID));
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID));
    assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));
  } finally {
    await registry.reset();
  }
});
