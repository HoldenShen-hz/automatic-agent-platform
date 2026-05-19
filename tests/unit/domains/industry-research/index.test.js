import assert from "node:assert/strict";
import test from "node:test";
import { IndustryResearchTaskTypeSchema, INDUSTRY_RESEARCH_DOMAIN_PRESET, requiresIndustryResearchReview, } from "../../../../src/domains/industry-research/index.js";
test("IndustryResearchTaskTypeSchema accepts valid task types", () => {
    const types = ["research", "summarize", "brief"];
    for (const type of types) {
        const result = IndustryResearchTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("IndustryResearchTaskTypeSchema rejects invalid task types", () => {
    const result = IndustryResearchTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("INDUSTRY_RESEARCH_DOMAIN_PRESET has correct domainId", () => {
    assert.equal(INDUSTRY_RESEARCH_DOMAIN_PRESET.domainId, "industry-research");
});
test("INDUSTRY_RESEARCH_DOMAIN_PRESET has correct displayName", () => {
    assert.equal(INDUSTRY_RESEARCH_DOMAIN_PRESET.displayName, "Industry Research");
});
test("INDUSTRY_RESEARCH_DOMAIN_PRESET has correct task types", () => {
    assert.deepEqual(INDUSTRY_RESEARCH_DOMAIN_PRESET.requiredCapabilities, ["research", "summarize", "brief"]);
});
test("INDUSTRY_RESEARCH_DOMAIN_PRESET reviewRequiredTaskTypes includes brief only", () => {
    assert.deepEqual(INDUSTRY_RESEARCH_DOMAIN_PRESET.reviewRequiredTaskTypes, ["brief"]);
});
test("requiresIndustryResearchReview returns true for brief task type", () => {
    assert.equal(requiresIndustryResearchReview("brief"), true);
});
test("requiresIndustryResearchReview returns false for research task type", () => {
    assert.equal(requiresIndustryResearchReview("research"), false);
});
test("requiresIndustryResearchReview returns false for summarize task type", () => {
    assert.equal(requiresIndustryResearchReview("summarize"), false);
});
//# sourceMappingURL=index.test.js.map