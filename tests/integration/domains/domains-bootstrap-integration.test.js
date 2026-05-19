/**
 * Integration Test: Domains Bootstrap
 *
 * Tests the DomainsBootstrap service registration and lifecycle with
 * actual ServiceRegistry integration and phase bootstrap services.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import { DOMAINS_BOOTSTRAP_SERVICE_ID, DOMAINS_CATALOG_SERVICE_ID, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS, buildDomainsBootstrap, buildDomainPhaseBootstrap, registerDomainsBootstrap, } from "../../../src/domains/domains-bootstrap.js";
import { listVerticalDomainBaselines, listVerticalDomainBaselinesByPhase } from "../../../src/domains/domain-baseline-catalog.js";
test.beforeEach(async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
});
test.afterEach(async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
});
test("integration: buildDomainsBootstrap returns bootstrap with all phases", async () => {
    const bootstrap = buildDomainsBootstrap();
    assert.ok("capabilityGroupId" in bootstrap, "bootstrap should have capabilityGroupId");
    assert.ok("catalog" in bootstrap, "bootstrap should have catalog");
    assert.ok("phases" in bootstrap, "bootstrap should have phases");
    assert.ok("registeredServiceIds" in bootstrap, "bootstrap should have registeredServiceIds");
    assert.ok("phaseServiceIds" in bootstrap, "bootstrap should have phaseServiceIds");
    assert.equal(bootstrap.capabilityGroupId, "domains");
    assert.equal(bootstrap.phases.length, 6, "should have 6 phases");
});
test("integration: buildDomainsBootstrap phases cover all vertical domain phases", async () => {
    const bootstrap = buildDomainsBootstrap();
    const phaseIds = bootstrap.phases.map((p) => p.phase);
    assert.ok(phaseIds.includes("9a"), "should include phase 9a");
    assert.ok(phaseIds.includes("9b"), "should include phase 9b");
    assert.ok(phaseIds.includes("9c"), "should include phase 9c");
    assert.ok(phaseIds.includes("9d"), "should include phase 9d");
    assert.ok(phaseIds.includes("9e"), "should include phase 9e");
    assert.ok(phaseIds.includes("9f"), "should include phase 9f");
});
test("integration: buildDomainsBootstrap catalog contains all domain baselines", async () => {
    const bootstrap = buildDomainsBootstrap();
    assert.ok(bootstrap.catalog.length > 0, "catalog should not be empty");
    assert.equal(bootstrap.catalog.length, 31, "should have 31 domain baselines");
    // Verify some expected domains
    assert.ok(bootstrap.catalog.some((b) => b.domainId === "coding"));
    assert.ok(bootstrap.catalog.some((b) => b.domainId === "quant-trading"));
    assert.ok(bootstrap.catalog.some((b) => b.domainId === "marketing"));
});
test("integration: buildDomainPhaseBootstrap creates correct phase bootstrap", async () => {
    const phase9a = buildDomainPhaseBootstrap("9a");
    assert.equal(phase9a.phase, "9a");
    assert.equal(phase9a.registeredServiceId, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9a"]);
    assert.ok(phase9a.baselines.length > 0, "phase should have baselines");
    // All baselines in phase 9a should have phase "9a"
    for (const baseline of phase9a.baselines) {
        assert.equal(baseline.phase, "9a", `${baseline.domainId} should be in phase 9a`);
    }
});
test("integration: buildDomainPhaseBootstrap phase9b has correct domains", async () => {
    const phase9b = buildDomainPhaseBootstrap("9b");
    assert.ok(phase9b.baselines.some((b) => b.domainId === "quant-trading"));
    assert.ok(phase9b.baselines.some((b) => b.domainId === "financial-services"));
    assert.ok(phase9b.baselines.some((b) => b.domainId === "ecommerce"));
    assert.ok(phase9b.baselines.some((b) => b.domainId === "advertising"));
});
test("integration: registerDomainsBootstrap registers all required services", async () => {
    const registry = ServiceRegistry.getInstance();
    const bootstrap = registerDomainsBootstrap(registry);
    // Verify main services are registered
    assert.ok(registry.isInitialized(DOMAINS_CATALOG_SERVICE_ID), "catalog service should be registered");
    assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID), "bootstrap service should be registered");
    // Verify all phase services are registered
    for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"]) {
        assert.ok(registry.isInitialized(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]), `Phase ${phase} bootstrap should be registered`);
    }
});
test("integration: registerDomainsBootstrap returns DomainsBootstrap instance", async () => {
    const registry = ServiceRegistry.getInstance();
    const bootstrap = registerDomainsBootstrap(registry);
    assert.ok("capabilityGroupId" in bootstrap);
    assert.ok("catalog" in bootstrap);
    assert.ok("phases" in bootstrap);
});
test("integration: registerDomainsBootstrap phase service IDs are correct", async () => {
    const registry = ServiceRegistry.getInstance();
    const bootstrap = registerDomainsBootstrap(registry);
    assert.deepEqual(bootstrap.phaseServiceIds, Object.values(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS), "phaseServiceIds should match DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS");
});
test("integration: registerDomainsBootstrap phases have correct structure", async () => {
    const registry = ServiceRegistry.getInstance();
    const bootstrap = registerDomainsBootstrap(registry);
    for (const phaseBootstrap of bootstrap.phases) {
        assert.ok("phase" in phaseBootstrap);
        assert.ok("baselines" in phaseBootstrap);
        assert.ok("registeredServiceId" in phaseBootstrap);
        assert.ok(Array.isArray(phaseBootstrap.baselines));
        assert.ok(phaseBootstrap.baselines.length > 0);
    }
});
test("integration: buildDomainsBootstrap catalog matches listVerticalDomainBaselines", async () => {
    const bootstrap = buildDomainsBootstrap();
    const baselines = listVerticalDomainBaselines();
    assert.equal(bootstrap.catalog.length, baselines.length);
});
test("integration: buildDomainsBootstrap phase baselines match listVerticalDomainBaselinesByPhase", async () => {
    const bootstrap = buildDomainsBootstrap();
    for (const phaseBootstrap of bootstrap.phases) {
        const expectedBaselines = listVerticalDomainBaselinesByPhase(phaseBootstrap.phase);
        assert.equal(phaseBootstrap.baselines.length, expectedBaselines.length, `${phaseBootstrap.phase} should have ${expectedBaselines.length} baselines`);
    }
});
test("integration: registerDomainsBootstrap can be called on fresh registry", async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
    const bootstrap = registerDomainsBootstrap(registry);
    assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID));
    assert.ok(bootstrap.phases.length === 6);
});
test("integration: DomainPhaseBootstrap registered service can be retrieved", async () => {
    const registry = ServiceRegistry.getInstance();
    registerDomainsBootstrap(registry);
    const phase9a = registry.get(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9a"]);
    assert.ok(phase9a != null);
    assert.equal(phase9a.phase, "9a");
    assert.ok(phase9a.baselines.length > 0);
});
test("integration: DomainsBootstrap registered service can be retrieved", async () => {
    const registry = ServiceRegistry.getInstance();
    registerDomainsBootstrap(registry);
    const bootstrap = registry.get(DOMAINS_BOOTSTRAP_SERVICE_ID);
    assert.ok(bootstrap != null);
    assert.equal(bootstrap.capabilityGroupId, "domains");
    assert.equal(bootstrap.phases.length, 6);
});
//# sourceMappingURL=domains-bootstrap-integration.test.js.map