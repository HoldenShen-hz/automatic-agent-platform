import assert from "node:assert/strict";
import test from "node:test";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import { DOMAINS_CATALOG_SERVICE_ID, DOMAINS_BOOTSTRAP_SERVICE_ID, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS, buildDomainPhaseBootstrap, buildDomainsBootstrap, registerDomainsBootstrap, } from "../../../../src/domains/domains-bootstrap.js";
import { listVerticalDomainBaselines, listVerticalDomainBaselinesByPhase, } from "../../../../src/domains/domain-baseline-catalog.js";
test("DOMAINS_CATALOG_SERVICE_ID is w5.domains.catalog", () => {
    assert.equal(DOMAINS_CATALOG_SERVICE_ID, "w5.domains.catalog");
});
test("DOMAINS_BOOTSTRAP_SERVICE_ID is w5.domains.bootstrap", () => {
    assert.equal(DOMAINS_BOOTSTRAP_SERVICE_ID, "w5.domains.bootstrap");
});
test("DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS contains all 6 phases", () => {
    const phases = ["9a", "9b", "9c", "9d", "9e", "9f"];
    assert.equal(phases.length, 6);
    for (const phase of phases) {
        assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase], `Missing service ID for phase ${phase}`);
        assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase].startsWith("w5.domains.phase."), "Service ID should start with w5.domains.phase.");
        assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase].includes(phase), "Service ID should contain phase");
    }
});
test("DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS has correct format for each phase", () => {
    const expectedIds = {
        "9a": "w5.domains.phase.9a.bootstrap",
        "9b": "w5.domains.phase.9b.bootstrap",
        "9c": "w5.domains.phase.9c.bootstrap",
        "9d": "w5.domains.phase.9d.bootstrap",
        "9e": "w5.domains.phase.9e.bootstrap",
        "9f": "w5.domains.phase.9f.bootstrap",
    };
    for (const [phase, expectedId] of Object.entries(expectedIds)) {
        assert.equal(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase], expectedId, `Phase ${phase} should have correct service ID`);
    }
});
test("buildDomainPhaseBootstrap returns correct structure for phase 9a", () => {
    const result = buildDomainPhaseBootstrap("9a");
    assert.equal(result.phase, "9a");
    assert.ok(Array.isArray(result.baselines), "baselines should be an array");
    assert.ok(result.baselines.length > 0, "baselines should not be empty for phase 9a");
    assert.equal(result.registeredServiceId, "w5.domains.phase.9a.bootstrap");
});
test("buildDomainPhaseBootstrap returns correct structure for phase 9f", () => {
    const result = buildDomainPhaseBootstrap("9f");
    assert.equal(result.phase, "9f");
    assert.ok(Array.isArray(result.baselines), "baselines should be an array");
    assert.equal(result.registeredServiceId, "w5.domains.phase.9f.bootstrap");
});
test("buildDomainPhaseBootstrap baselines match listVerticalDomainBaselinesByPhase", () => {
    const phases = ["9a", "9b", "9c", "9d", "9e", "9f"];
    for (const phase of phases) {
        const result = buildDomainPhaseBootstrap(phase);
        const expected = listVerticalDomainBaselinesByPhase(phase);
        assert.deepEqual(result.baselines, expected, `Baselines should match for phase ${phase}`);
    }
});
test("buildDomainPhaseBootstrap returns readonly arrays", () => {
    const result = buildDomainPhaseBootstrap("9a");
    assert.ok(Array.isArray(result.baselines), "baselines should be array");
    assert.ok(Array.isArray(result.baselines), "baselines should be readonly array");
});
test("buildDomainsBootstrap returns correct capabilityGroupId", () => {
    const result = buildDomainsBootstrap();
    assert.equal(result.capabilityGroupId, "domains");
});
test("buildDomainsBootstrap returns catalog with all domain baselines", () => {
    const result = buildDomainsBootstrap();
    const allBaselines = listVerticalDomainBaselines();
    assert.ok(Array.isArray(result.catalog), "catalog should be an array");
    assert.equal(result.catalog.length, allBaselines.length, "catalog should contain all baselines");
    assert.deepEqual(result.catalog, allBaselines, "catalog should match all baselines");
});
test("buildDomainsBootstrap returns 6 phases", () => {
    const result = buildDomainsBootstrap();
    assert.ok(Array.isArray(result.phases), "phases should be an array");
    assert.equal(result.phases.length, 6, "should have 6 phases");
});
test("buildDomainsBootstrap phases are in correct order (9a to 9f)", () => {
    const result = buildDomainsBootstrap();
    const phaseOrder = ["9a", "9b", "9c", "9d", "9e", "9f"];
    assert.equal(result.phases.length, phaseOrder.length);
    for (let i = 0; i < phaseOrder.length; i++) {
        assert.equal(result.phases[i]?.phase, phaseOrder[i], `Phase at index ${i} should be ${phaseOrder[i]}`);
    }
});
test("buildDomainsBootstrap registeredServiceIds contains catalog and bootstrap service IDs", () => {
    const result = buildDomainsBootstrap();
    assert.ok(Array.isArray(result.registeredServiceIds), "registeredServiceIds should be an array");
    assert.equal(result.registeredServiceIds.length, 2);
    assert.ok(result.registeredServiceIds.includes(DOMAINS_CATALOG_SERVICE_ID));
    assert.ok(result.registeredServiceIds.includes(DOMAINS_BOOTSTRAP_SERVICE_ID));
});
test("buildDomainsBootstrap phaseServiceIds contains all phase service IDs", () => {
    const result = buildDomainsBootstrap();
    const phases = ["9a", "9b", "9c", "9d", "9e", "9f"];
    assert.ok(Array.isArray(result.phaseServiceIds), "phaseServiceIds should be an array");
    assert.equal(result.phaseServiceIds.length, phases.length);
    for (const phase of phases) {
        assert.ok(result.phaseServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]));
    }
});
test("buildDomainsBootstrap phases contain valid DomainPhaseBootstrap objects", () => {
    const result = buildDomainsBootstrap();
    for (const phaseBootstrap of result.phases) {
        assert.ok(phaseBootstrap.phase, "phase should exist");
        assert.ok(Array.isArray(phaseBootstrap.baselines), "baselines should be an array");
        assert.ok(phaseBootstrap.registeredServiceId, "registeredServiceId should exist");
    }
});
test("registerDomainsBootstrap registers services in ServiceRegistry", () => {
    const registry = ServiceRegistry.getInstance();
    const result = registerDomainsBootstrap(registry);
    assert.ok(registry.isInitialized(DOMAINS_CATALOG_SERVICE_ID), "catalog service should be initialized");
    assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID), "bootstrap service should be initialized");
    for (const phase of ["9a", "9b", "9c", "9d", "9e", "9f"]) {
        assert.ok(registry.isInitialized(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS[phase]), `Phase ${phase} service should be initialized`);
    }
});
test("registerDomainsBootstrap returns DomainsBootstrap", () => {
    const registry = ServiceRegistry.getInstance();
    const result = registerDomainsBootstrap(registry);
    assert.equal(result.capabilityGroupId, "domains");
    assert.ok(Array.isArray(result.catalog));
    assert.ok(Array.isArray(result.phases));
    assert.ok(Array.isArray(result.registeredServiceIds));
    assert.ok(Array.isArray(result.phaseServiceIds));
});
test("registerDomainsBootstrap with default registry creates singleton", () => {
    const result = registerDomainsBootstrap();
    assert.ok(result instanceof Object, "should return DomainsBootstrap");
    assert.equal(result.capabilityGroupId, "domains");
});
test("DomainPhaseBootstrap interface structure is correct", () => {
    const phase = buildDomainPhaseBootstrap("9a");
    // Check the type has expected readonly properties
    const phaseValue = phase.phase;
    const baselinesReadonly = phase.baselines;
    const serviceId = phase.registeredServiceId;
    assert.equal(typeof phaseValue, "string");
    assert.ok(Array.isArray(baselinesReadonly));
    assert.equal(typeof serviceId, "string");
});
test("DomainsBootstrap interface structure is correct", () => {
    const bootstrap = buildDomainsBootstrap();
    const capabilityGroupId = bootstrap.capabilityGroupId;
    const catalogReadonly = bootstrap.catalog;
    const phasesReadonly = bootstrap.phases;
    const registeredIdsReadonly = bootstrap.registeredServiceIds;
    const phaseIdsReadonly = bootstrap.phaseServiceIds;
    assert.equal(capabilityGroupId, "domains");
    assert.ok(Array.isArray(catalogReadonly));
    assert.ok(Array.isArray(phasesReadonly));
    assert.ok(Array.isArray(registeredIdsReadonly));
    assert.ok(Array.isArray(phaseIdsReadonly));
});
test("phases baselines are specific to their phase", () => {
    const bootstrap = buildDomainsBootstrap();
    for (const phaseBootstrap of bootstrap.phases) {
        const phase = phaseBootstrap.phase;
        const baselines = listVerticalDomainBaselinesByPhase(phase);
        assert.deepEqual(phaseBootstrap.baselines, baselines, `Phase ${phase} baselines should match listVerticalDomainBaselinesByPhase`);
    }
});
test("all domain baselines are accounted for across phases", () => {
    const bootstrap = buildDomainsBootstrap();
    const allBaselines = listVerticalDomainBaselines();
    let totalBaselinesInPhases = 0;
    for (const phaseBootstrap of bootstrap.phases) {
        totalBaselinesInPhases += phaseBootstrap.baselines.length;
    }
    assert.equal(totalBaselinesInPhases, allBaselines.length, "All baselines should be distributed across phases");
});
test("registerDomainsBootstrap is idempotent for same service", () => {
    const registry = ServiceRegistry.getInstance();
    const result1 = registerDomainsBootstrap(registry);
    const result2 = registerDomainsBootstrap(registry);
    // Both should return the same structure
    assert.deepEqual(result1, result2);
});
test("ServiceRegistry reset clears domain bootstrap services", async () => {
    const registry = ServiceRegistry.getInstance();
    registerDomainsBootstrap(registry);
    assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID));
    await registry.reset();
    assert.ok(!registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID));
});
//# sourceMappingURL=domain-bootstrap.test.js.map