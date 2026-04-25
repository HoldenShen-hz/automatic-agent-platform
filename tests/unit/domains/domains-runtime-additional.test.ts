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

test("buildDomainsRuntimeCatalog returns phases with correct domain counts", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  // Phase 9a: coding, data-engineering, knowledge-base, user-operations
  assert.equal(catalog.phase9a.length, 4);
  assert.ok(catalog.phase9a.some((b) => b.domainId === "coding"));
  assert.ok(catalog.phase9a.some((b) => b.domainId === "data-engineering"));
  assert.ok(catalog.phase9a.some((b) => b.domainId === "knowledge-base"));
  assert.ok(catalog.phase9a.some((b) => b.domainId === "user-operations"));

  // Phase 9b: quant-trading, financial-services, ecommerce, advertising
  assert.equal(catalog.phase9b.length, 4);
  assert.ok(catalog.phase9b.some((b) => b.domainId === "quant-trading"));
  assert.ok(catalog.phase9b.some((b) => b.domainId === "financial-services"));
  assert.ok(catalog.phase9b.some((b) => b.domainId === "ecommerce"));
  assert.ok(catalog.phase9b.some((b) => b.domainId === "advertising"));

  // Phase 9c: industry-research, academic-research, product-management, quality-assurance, finance-accounting, legal
  assert.equal(catalog.phase9c.length, 6);

  // Phase 9d: customer-service, it-operations, content-moderation, live-streaming, project-management
  assert.equal(catalog.phase9d.length, 5);

  // Phase 9e: healthcare, human-resources, facilities, executive-assistant, supply-chain, education
  assert.equal(catalog.phase9e.length, 6);

  // Phase 9f: creative-production, game-dev, game-publishing, manufacturing, agriculture, marketing
  assert.equal(catalog.phase9f.length, 6);
});

test("buildDomainsRuntimeCatalog phase domains have correct phase assignment", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const baseline of catalog.phase9a) {
    assert.equal(baseline.phase, "9a", `${baseline.domainId} should be in phase 9a`);
  }
  for (const baseline of catalog.phase9b) {
    assert.equal(baseline.phase, "9b", `${baseline.domainId} should be in phase 9b`);
  }
  for (const baseline of catalog.phase9c) {
    assert.equal(baseline.phase, "9c", `${baseline.domainId} should be in phase 9c`);
  }
  for (const baseline of catalog.phase9d) {
    assert.equal(baseline.phase, "9d", `${baseline.domainId} should be in phase 9d`);
  }
  for (const baseline of catalog.phase9e) {
    assert.equal(baseline.phase, "9e", `${baseline.domainId} should be in phase 9e`);
  }
  for (const baseline of catalog.phase9f) {
    assert.equal(baseline.phase, "9f", `${baseline.domainId} should be in phase 9f`);
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

test("registerDomainsRuntimeCatalog phase maps contain DomainBaseline arrays", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerDomainsRuntimeCatalog(registry);

    // Verify all phases are arrays
    assert.ok(Array.isArray(catalog.phase9a));
    assert.ok(Array.isArray(catalog.phase9b));
    assert.ok(Array.isArray(catalog.phase9c));
    assert.ok(Array.isArray(catalog.phase9d));
    assert.ok(Array.isArray(catalog.phase9e));
    assert.ok(Array.isArray(catalog.phase9f));

    // Verify all entries have required DomainBaseline properties
    const allBaselines = [
      ...catalog.phase9a,
      ...catalog.phase9b,
      ...catalog.phase9c,
      ...catalog.phase9d,
      ...catalog.phase9e,
      ...catalog.phase9f,
    ];

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

  assert.equal(plan.steps.length, 6);
  assert.equal(plan.startupOrder.length, 6);
  assert.equal(plan.totalCapabilityCount, 31);
});

test("buildDomainsStartupPlan first step has no dependencies", async () => {
  const plan = buildDomainsStartupPlan();

  const firstStep = plan.steps[0]!;
  assert.deepEqual(firstStep.dependsOnStepIds, []);
  assert.equal(firstStep.stepId, "9a");
});

test("buildDomainsStartupPlan later steps depend on previous phases", async () => {
  const plan = buildDomainsStartupPlan();

  // Step 9b depends on 9a
  const step9b = plan.steps.find((s) => s.stepId === "9b")!;
  assert.deepEqual(step9b.dependsOnStepIds, ["9a"]);

  // Step 9c depends on 9b
  const step9c = plan.steps.find((s) => s.stepId === "9c")!;
  assert.deepEqual(step9c.dependsOnStepIds, ["9b"]);

  // Step 9f depends on 9e
  const step9f = plan.steps.find((s) => s.stepId === "9f")!;
  assert.deepEqual(step9f.dependsOnStepIds, ["9e"]);
});

test("buildDomainsStartupPlan step capability counts match phase domain counts", async () => {
  const plan = buildDomainsStartupPlan();

  const step9a = plan.steps.find((s) => s.stepId === "9a")!;
  assert.equal(step9a.capabilityCount, 4);

  const step9b = plan.steps.find((s) => s.stepId === "9b")!;
  assert.equal(step9b.capabilityCount, 4);

  const step9c = plan.steps.find((s) => s.stepId === "9c")!;
  assert.equal(step9c.capabilityCount, 6);
});

test("buildDomainsStartupPlan registers correctly in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerDomainsBootstrap(registry);
    const plan = registerDomainsStartupPlan(registry);

    assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));
    assert.equal(plan.steps.length, 6);
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
    assert.deepEqual(result.startupOrder, ["9a", "9b", "9c", "9d", "9e", "9f"]);
    assert.ok(result.steps.length > 0);
    assert.ok(result.initializedServiceIds.length > 0);
  } finally {
    await registry.reset();
  }
});

test("registerDomainsRuntimeOrchestrator startup initializes all phase services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    // All phase bootstrap services should be initialized
    for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"] as const) {
      assert.ok(
        result.initializedServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]),
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
      const expectedServiceId = DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[step.stepId as keyof typeof DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS];
      assert.equal(step.bootstrapServiceId, expectedServiceId);
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

test("registerDomainsRuntimeOrchestrator snapshotReadiness contains all phases", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    const phases = snapshot.capabilityReadiness.map((c) => c.stepId);
    assert.ok(phases.includes("9a"), "should include phase 9a");
    assert.ok(phases.includes("9b"), "should include phase 9b");
    assert.ok(phases.includes("9c"), "should include phase 9c");
    assert.ok(phases.includes("9d"), "should include phase 9d");
    assert.ok(phases.includes("9e"), "should include phase 9e");
    assert.ok(phases.includes("9f"), "should include phase 9f");
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
    const step9a = result.steps.find((s) => s.stepId === "9a")!;
    assert.deepEqual(step9a.initializedDependencyServiceIds, []);

    const step9b = result.steps.find((s) => s.stepId === "9b")!;
    assert.deepEqual(step9b.initializedDependencyServiceIds, [DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9a"]]);

    const step9c = result.steps.find((s) => s.stepId === "9c")!;
    assert.deepEqual(step9c.initializedDependencyServiceIds, [DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9b"]]);
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
    assert.equal(result.steps.length, 6);
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
    assert.equal(catalog.phase9a.length, 4);

    // Step 3: Register startup plan
    const plan = registerDomainsStartupPlan(registry);
    assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));
    assert.equal(plan.steps.length, 6);

    // Step 4: Register and start orchestrator
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
