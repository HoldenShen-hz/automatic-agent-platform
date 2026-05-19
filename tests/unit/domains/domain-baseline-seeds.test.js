import assert from "node:assert/strict";
import test from "node:test";
import { DOMAIN_SEEDS } from "../../../src/domains/domain-baseline-seeds.js";
test("DOMAIN_SEEDS exports a non-empty array", () => {
    assert.ok(Array.isArray(DOMAIN_SEEDS));
    assert.ok(DOMAIN_SEEDS.length > 0);
});
test("DOMAIN_SEEDS contains 31 domain seeds", () => {
    assert.equal(DOMAIN_SEEDS.length, 31);
});
test("each DomainSeed has required fields", () => {
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(seed.phase, `seed ${seed.domainId} missing phase`);
        assert.ok(seed.domainId, `seed missing domainId`);
        assert.ok(Array.isArray(seed.legacyDomainIds), `seed ${seed.domainId} missing legacyDomainIds`);
        assert.ok(seed.displayName, `seed ${seed.domainId} missing displayName`);
        assert.ok(seed.description, `seed ${seed.domainId} missing description`);
        assert.ok(seed.riskLevel, `seed ${seed.domainId} missing riskLevel`);
        assert.ok(seed.ownerOrgNodeId, `seed ${seed.domainId} missing ownerOrgNodeId`);
        assert.ok(Array.isArray(seed.taskTypes), `seed ${seed.domainId} missing taskTypes`);
        assert.ok(Array.isArray(seed.tags), `seed ${seed.domainId} missing tags`);
        assert.ok(Array.isArray(seed.workflowStages), `seed ${seed.domainId} missing workflowStages`);
        assert.ok(Array.isArray(seed.requiredTools), `seed ${seed.domainId} missing requiredTools`);
        assert.ok(Array.isArray(seed.optionalTools), `seed ${seed.domainId} missing optionalTools`);
        assert.ok(Array.isArray(seed.externalAdapters), `seed ${seed.domainId} missing externalAdapters`);
        assert.ok(Array.isArray(seed.blockingMetrics), `seed ${seed.domainId} missing blockingMetrics`);
        assert.ok(Array.isArray(seed.advisoryMetrics), `seed ${seed.domainId} missing advisoryMetrics`);
        assert.ok(seed.latencyProfile, `seed ${seed.domainId} missing latencyProfile`);
        assert.ok(seed.ownershipProfile, `seed ${seed.domainId} missing ownershipProfile`);
        assert.ok(seed.rolloutStrategy, `seed ${seed.domainId} missing rolloutStrategy`);
        assert.ok(Array.isArray(seed.restrictedDataClasses), `seed ${seed.domainId} missing restrictedDataClasses`);
    }
});
test("each DomainSeed phase is valid", () => {
    const validPhases = ["9a", "9b", "9c", "9d", "9e", "9f"];
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(validPhases.includes(seed.phase), `seed ${seed.domainId} has invalid phase: ${seed.phase}`);
    }
});
test("each DomainSeed riskLevel is valid", () => {
    const validRiskLevels = ["low", "medium", "high", "critical"];
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(validRiskLevels.includes(seed.riskLevel), `seed ${seed.domainId} has invalid riskLevel: ${seed.riskLevel}`);
    }
});
test("each DomainSeed has at least one task type", () => {
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(seed.taskTypes.length > 0, `seed ${seed.domainId} has no taskTypes`);
    }
});
test("each DomainSeed has at least one required tool", () => {
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(seed.requiredTools.length > 0, `seed ${seed.domainId} has no requiredTools`);
    }
});
test("each DomainSeed has at least one workflow stage", () => {
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(seed.workflowStages.length > 0, `seed ${seed.domainId} has no workflowStages`);
    }
});
test("each DomainSeed latencyProfile has valid tier", () => {
    const validTiers = ["ultra_realtime", "realtime", "near_realtime", "business_day"];
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(validTiers.includes(seed.latencyProfile.tier), `seed ${seed.domainId} has invalid latency tier: ${seed.latencyProfile.tier}`);
        assert.ok(seed.latencyProfile.targetResponseMinutes > 0, `seed ${seed.domainId} has invalid targetResponseMinutes`);
        assert.ok(seed.latencyProfile.maxResponseMinutes >= seed.latencyProfile.targetResponseMinutes, `seed ${seed.domainId} maxResponseMinutes < targetResponseMinutes`);
    }
});
test("each DomainSeed latencyProfile dataSensitivity is valid", () => {
    const validSensitivities = ["internal", "confidential", "regulated"];
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(validSensitivities.includes(seed.latencyProfile.dataSensitivity), `seed ${seed.domainId} has invalid dataSensitivity: ${seed.latencyProfile.dataSensitivity}`);
    }
});
test("each DomainSeed ownershipProfile has required fields", () => {
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(seed.ownershipProfile.divisionId, `seed ${seed.domainId} missing ownershipProfile.divisionId`);
        assert.ok(seed.ownershipProfile.ownerTeam, `seed ${seed.domainId} missing ownershipProfile.ownerTeam`);
        assert.ok(seed.ownershipProfile.escalationTeam, `seed ${seed.domainId} missing ownershipProfile.escalationTeam`);
    }
});
test("each DomainSeed rolloutStrategy is valid", () => {
    const validStrategies = ["canary", "supervised_auto", "shadow"];
    for (const seed of DOMAIN_SEEDS) {
        assert.ok(validStrategies.includes(seed.rolloutStrategy), `seed ${seed.domainId} has invalid rolloutStrategy: ${seed.rolloutStrategy}`);
    }
});
test("critical risk domains have restricted data classes", () => {
    const criticalSeeds = DOMAIN_SEEDS.filter((seed) => seed.riskLevel === "critical");
    assert.ok(criticalSeeds.length > 0, "should have at least one critical risk domain");
    for (const seed of criticalSeeds) {
        assert.ok(seed.restrictedDataClasses.length > 0, `critical seed ${seed.domainId} should have restrictedDataClasses`);
    }
});
test("DOMAIN_SEEDS covers all phases 9a through 9f", () => {
    const phases = new Set(DOMAIN_SEEDS.map((seed) => seed.phase));
    assert.ok(phases.has("9a"), "missing phase 9a");
    assert.ok(phases.has("9b"), "missing phase 9b");
    assert.ok(phases.has("9c"), "missing phase 9c");
    assert.ok(phases.has("9d"), "missing phase 9d");
    assert.ok(phases.has("9e"), "missing phase 9e");
    assert.ok(phases.has("9f"), "missing phase 9f");
});
test("DOMAIN_SEEDS includes known critical domains", () => {
    const criticalDomainIds = DOMAIN_SEEDS.filter((seed) => seed.riskLevel === "critical").map((seed) => seed.domainId);
    assert.ok(criticalDomainIds.includes("quant-trading"), "missing quant-trading critical domain");
    assert.ok(criticalDomainIds.includes("financial-services"), "missing financial-services critical domain");
    assert.ok(criticalDomainIds.includes("legal"), "missing legal critical domain");
    assert.ok(criticalDomainIds.includes("healthcare"), "missing healthcare critical domain");
});
test("DomainSeed type correctly reflects readonly arrays", () => {
    const seed = DOMAIN_SEEDS[0];
    assert.equal(Object.isFrozen(seed.taskTypes), true, "taskTypes should be readonly");
    assert.equal(Object.isFrozen(seed.requiredTools), true, "requiredTools should be readonly");
    assert.equal(Object.isFrozen(seed.legacyDomainIds), true, "legacyDomainIds should be readonly");
});
//# sourceMappingURL=domain-baseline-seeds.test.js.map