import assert from "node:assert/strict";
import test from "node:test";
import { CreativeProductionTaskTypeSchema, CREATIVE_PRODUCTION_DOMAIN_PRESET, requiresCreativeProductionReview, } from "../../../../src/domains/creative-production/index.js";
test("CreativeProductionTaskTypeSchema accepts valid task types", () => {
    const types = ["concept", "draft", "iterate"];
    for (const type of types) {
        const result = CreativeProductionTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("CreativeProductionTaskTypeSchema rejects invalid task types", () => {
    const result = CreativeProductionTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("CREATIVE_PRODUCTION_DOMAIN_PRESET has correct structure", () => {
    assert.equal(CREATIVE_PRODUCTION_DOMAIN_PRESET.domainId, "creative-production");
    assert.ok(Array.isArray(CREATIVE_PRODUCTION_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(Array.isArray(CREATIVE_PRODUCTION_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(Array.isArray(CREATIVE_PRODUCTION_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Array.isArray(CREATIVE_PRODUCTION_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
test("CREATIVE_PRODUCTION_DOMAIN_PRESET has correct required capabilities", () => {
    assert.deepEqual(CREATIVE_PRODUCTION_DOMAIN_PRESET.requiredCapabilities, ["concept", "draft", "iterate"]);
});
test("CREATIVE_PRODUCTION_DOMAIN_PRESET has correct review required task types", () => {
    assert.deepEqual(CREATIVE_PRODUCTION_DOMAIN_PRESET.reviewRequiredTaskTypes, ["draft", "iterate"]);
});
test("requiresCreativeProductionReview returns true for draft task type", () => {
    assert.equal(requiresCreativeProductionReview("draft"), true);
});
test("requiresCreativeProductionReview returns true for iterate task type", () => {
    assert.equal(requiresCreativeProductionReview("iterate"), true);
});
test("requiresCreativeProductionReview returns false for concept task type", () => {
    assert.equal(requiresCreativeProductionReview("concept"), false);
});
//# sourceMappingURL=index.test.js.map