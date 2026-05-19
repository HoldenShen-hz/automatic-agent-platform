import assert from "node:assert/strict";
import test from "node:test";
import { buildDomainPhaseBootstrap, buildDomainsBootstrap, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS, DOMAINS_BOOTSTRAP_SERVICE_ID, DOMAINS_CATALOG_SERVICE_ID, } from "../../../src/domains/domains-bootstrap.js";
test("buildDomainPhaseBootstrap creates phase bootstrap for 9a", () => {
    const result = buildDomainPhaseBootstrap("9a");
    assert.ok(result);
    assert.equal(result.phase, "9a");
    assert.ok(Array.isArray(result.baselines));
    assert.ok(result.baselines.length > 0);
    assert.equal(result.baselines.every((b) => b.phase === "9a"), true);
});
test("buildDomainPhaseBootstrap creates phase bootstrap for 9b", () => {
    const result = buildDomainPhaseBootstrap("9b");
    assert.ok(result);
    assert.equal(result.phase, "9b");
});
test("buildDomainPhaseBootstrap creates phase bootstrap for 9c", () => {
    const result = buildDomainPhaseBootstrap("9c");
    assert.ok(result);
    assert.equal(result.phase, "9c");
});
test("buildDomainPhaseBootstrap creates phase bootstrap for 9d", () => {
    const result = buildDomainPhaseBootstrap("9d");
    assert.ok(result);
    assert.equal(result.phase, "9d");
});
test("buildDomainPhaseBootstrap creates phase bootstrap for 9e", () => {
    const result = buildDomainPhaseBootstrap("9e");
    assert.ok(result);
    assert.equal(result.phase, "9e");
});
test("buildDomainPhaseBootstrap creates phase bootstrap for 9f", () => {
    const result = buildDomainPhaseBootstrap("9f");
    assert.ok(result);
    assert.equal(result.phase, "9f");
});
test("buildDomainPhaseBootstrap includes correct service ID", () => {
    const result = buildDomainPhaseBootstrap("9a");
    assert.equal(result.registeredServiceId, DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9a"]);
});
test("buildDomainPhaseBootstrap returns non-empty baselines array", () => {
    const result = buildDomainPhaseBootstrap("9a");
    assert.ok(Array.isArray(result.baselines));
    assert.ok(result.baselines.length > 0);
});
test("buildDomainsBootstrap creates full bootstrap structure", () => {
    const result = buildDomainsBootstrap();
    assert.ok(result);
    assert.equal(result.capabilityGroupId, "domains");
    assert.ok(Array.isArray(result.catalog));
    assert.ok(Array.isArray(result.phases));
    assert.ok(Array.isArray(result.registeredServiceIds));
    assert.ok(Array.isArray(result.phaseServiceIds));
});
test("buildDomainsBootstrap includes all 6 phases", () => {
    const result = buildDomainsBootstrap();
    assert.equal(result.phases.length, 6);
    const phaseNames = result.phases.map((p) => p.phase);
    assert.ok(phaseNames.includes("9a"));
    assert.ok(phaseNames.includes("9b"));
    assert.ok(phaseNames.includes("9c"));
    assert.ok(phaseNames.includes("9d"));
    assert.ok(phaseNames.includes("9e"));
    assert.ok(phaseNames.includes("9f"));
});
test("buildDomainsBootstrap catalog contains 31 domain baselines", () => {
    const result = buildDomainsBootstrap();
    assert.equal(result.catalog.length, 31);
});
test("buildDomainsBootstrap registeredServiceIds contains correct service IDs", () => {
    const result = buildDomainsBootstrap();
    assert.ok(result.registeredServiceIds.includes(DOMAINS_CATALOG_SERVICE_ID));
    assert.ok(result.registeredServiceIds.includes(DOMAINS_BOOTSTRAP_SERVICE_ID));
});
test("buildDomainsBootstrap phaseServiceIds contains all phase service IDs", () => {
    const result = buildDomainsBootstrap();
    assert.equal(result.phaseServiceIds.length, 6);
    assert.ok(result.phaseServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9a"]));
    assert.ok(result.phaseServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9b"]));
    assert.ok(result.phaseServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9c"]));
    assert.ok(result.phaseServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9d"]));
    assert.ok(result.phaseServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9e"]));
    assert.ok(result.phaseServiceIds.includes(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9f"]));
});
test("buildDomainsBootstrap phases have correct structure", () => {
    const result = buildDomainsBootstrap();
    for (const phaseBootstrap of result.phases) {
        assert.ok(phaseBootstrap.phase);
        assert.ok(Array.isArray(phaseBootstrap.baselines));
        assert.ok(phaseBootstrap.registeredServiceId);
    }
});
test("buildDomainsBootstrap phases are in order 9a through 9f", () => {
    const result = buildDomainsBootstrap();
    const phaseOrder = result.phases.map((p) => p.phase);
    assert.deepEqual(phaseOrder, ["9a", "9b", "9c", "9d", "9e", "9f"]);
});
test("DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS has all 6 phases", () => {
    assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9a"]);
    assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9b"]);
    assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9c"]);
    assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9d"]);
    assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9e"]);
    assert.ok(DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS["9f"]);
});
test("each phase bootstrap has baselines matching its phase", () => {
    const result = buildDomainsBootstrap();
    for (const phaseBootstrap of result.phases) {
        for (const baseline of phaseBootstrap.baselines) {
            assert.equal(baseline.phase, phaseBootstrap.phase);
        }
    }
});
//# sourceMappingURL=domains-bootstrap-functions.test.js.map