import assert from "node:assert/strict";
import test from "node:test";
import { SupplyChainTaskTypeSchema, SUPPLY_CHAIN_DOMAIN_PRESET, requiresSupplyChainReview, } from "../../../../src/domains/supply-chain/index.js";
test("SupplyChainTaskTypeSchema accepts valid task types", () => {
    const types = ["plan", "route", "resolve"];
    for (const type of types) {
        const result = SupplyChainTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("SupplyChainTaskTypeSchema rejects invalid task types", () => {
    const result = SupplyChainTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("SUPPLY_CHAIN_DOMAIN_PRESET has correct structure", () => {
    assert.equal(SUPPLY_CHAIN_DOMAIN_PRESET.domainId, "supply-chain");
    assert.ok(Array.isArray(SUPPLY_CHAIN_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(Array.isArray(SUPPLY_CHAIN_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(Array.isArray(SUPPLY_CHAIN_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Array.isArray(SUPPLY_CHAIN_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
test("SUPPLY_CHAIN_DOMAIN_PRESET has correct required capabilities", () => {
    assert.deepEqual(SUPPLY_CHAIN_DOMAIN_PRESET.requiredCapabilities, ["plan", "route", "resolve"]);
});
test("SUPPLY_CHAIN_DOMAIN_PRESET has correct review required task types", () => {
    assert.deepEqual(SUPPLY_CHAIN_DOMAIN_PRESET.reviewRequiredTaskTypes, ["route", "resolve"]);
});
test("requiresSupplyChainReview returns true for route task type", () => {
    assert.equal(requiresSupplyChainReview("route"), true);
});
test("requiresSupplyChainReview returns true for resolve task type", () => {
    assert.equal(requiresSupplyChainReview("resolve"), true);
});
test("requiresSupplyChainReview returns false for plan task type", () => {
    assert.equal(requiresSupplyChainReview("plan"), false);
});
//# sourceMappingURL=index.test.js.map