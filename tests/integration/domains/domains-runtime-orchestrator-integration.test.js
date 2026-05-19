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
import { DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID, DomainsRuntimeOrchestrator, registerDomainsRuntimeOrchestrator, } from "../../../src/domains-runtime-orchestrator.js";
import { DOMAINS_RUNTIME_CATALOG_SERVICE_ID, } from "../../../src/domains-runtime-catalog.js";
import { DOMAINS_BOOTSTRAP_SERVICE_ID, DOMAINS_CATALOG_SERVICE_ID, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS, } from "../../../src/domains/domains-bootstrap.js";
import { DOMAINS_STARTUP_PLAN_SERVICE_ID, } from "../../../src/domains-startup-plan.js";
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
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID), "orchestrator should be registered");
    // Verify bootstrap services are registered
    assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID), "bootstrap should be registered");
    assert.ok(registry.isInitialized(DOMAINS_CATALOG_SERVICE_ID), "catalog should be registered");
    // Verify all phase bootstrap services are registered
    for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"]) {
        assert.ok(registry.isInitialized(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]), `Phase ${phase} bootstrap should be registered`);
    }
    // Verify runtime catalog and startup plan are registered
    assert.ok(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID), "runtime catalog should be registered");
    assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID), "startup plan should be registered");
    // Verify orchestrator instance
    const retrieved = registry.get(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
    assert.ok(retrieved instanceof DomainsRuntimeOrchestrator);
});
test("integration: DomainsRuntimeOrchestrator startup produces correct ring order", async () => {
    const registry = ServiceRegistry.getInstance();
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    assert.equal(result.ready, true, "startup should be ready");
    assert.deepEqual(result.startupOrder, ["ring1", "ring2", "ring3"], "startup order should follow ring sequence");
});
test("integration: DomainsRuntimeOrchestrator startup initializes all ring services", async () => {
    const registry = ServiceRegistry.getInstance();
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    assert.deepEqual(result.initializedServiceIds, [
        "w5.domains.ring.ring1.bootstrap",
        "w5.domains.ring.ring2.bootstrap",
        "w5.domains.ring.ring3.bootstrap",
    ]);
});
test("integration: DomainsRuntimeOrchestrator startup steps reflect correct dependency chain", async () => {
    const registry = ServiceRegistry.getInstance();
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    const ring1 = result.steps.find((s) => s.stepId === "ring1");
    assert.deepEqual(ring1.initializedDependencyServiceIds, [], "ring1 should have no dependencies");
    const ring2 = result.steps.find((s) => s.stepId === "ring2");
    assert.deepEqual(ring2.initializedDependencyServiceIds, ["w5.domains.ring.ring1.bootstrap"]);
    const ring3 = result.steps.find((s) => s.stepId === "ring3");
    assert.deepEqual(ring3.initializedDependencyServiceIds, ["w5.domains.ring.ring2.bootstrap"]);
});
test("integration: DomainsRuntimeOrchestrator snapshotReadiness captures all rings", async () => {
    const registry = ServiceRegistry.getInstance();
    const orchestrator = registerDomainsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();
    assert.equal(snapshot.orchestratorInitialized, true, "orchestrator should be initialized");
    assert.equal(snapshot.runtimeCatalogInitialized, true, "runtime catalog should be initialized");
    assert.equal(snapshot.startupPlanInitialized, true, "startup plan should be initialized");
    const rings = snapshot.capabilityReadiness.map((c) => c.stepId);
    assert.ok(rings.includes("ring1"), "should include ring1");
    assert.ok(rings.includes("ring2"), "should include ring2");
    assert.ok(rings.includes("ring3"), "should include ring3");
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
    assert.equal(plan.steps.length, 3, "should have 3 steps");
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
    assert.equal(result.steps.length, 3);
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
    const catalog = registry.get(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);
    assert.ok(catalog.ring1.length > 0, "ring1 should have baselines");
    assert.ok(catalog.ring2.length > 0, "ring2 should have baselines");
    assert.ok(catalog.ring3.length > 0, "ring3 should have baselines");
});
//# sourceMappingURL=domains-runtime-orchestrator-integration.test.js.map