import assert from "node:assert/strict";
import test from "node:test";
import { CODING_DOMAIN_PRESET, CodingDomainPresetSchema, CodingTaskTypeSchema, requiresCodingReview, } from "../../../../src/domains/coding/index.js";
test("CodingTaskTypeSchema accepts valid task types", () => {
    const types = ["analyze", "plan", "implement", "test", "review", "release"];
    for (const type of types) {
        const result = CodingTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("CodingTaskTypeSchema rejects invalid task types", () => {
    const result = CodingTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("CodingDomainPresetSchema parses valid preset", () => {
    const result = CodingDomainPresetSchema.safeParse(CODING_DOMAIN_PRESET);
    assert.equal(result.success, true);
    assert.equal(result.data?.domainId, "coding");
    assert.equal(result.data?.displayName, "Coding");
});
test("CODING_DOMAIN_PRESET has correct default values", () => {
    assert.deepEqual(CODING_DOMAIN_PRESET.defaultWorkflowIds, ["coding_change"]);
    assert.deepEqual(CODING_DOMAIN_PRESET.defaultToolBundleIds, ["repo_tools", "build_tools", "test_tools"]);
    assert.deepEqual(CODING_DOMAIN_PRESET.requiredCapabilities, ["analyze", "implement", "test"]);
    assert.deepEqual(CODING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["implement", "release"]);
});
test("requiresCodingReview returns true for implement task type", () => {
    assert.equal(requiresCodingReview("implement"), true);
});
test("requiresCodingReview returns true for release task type", () => {
    assert.equal(requiresCodingReview("release"), true);
});
test("requiresCodingReview returns false for analyze task type", () => {
    assert.equal(requiresCodingReview("analyze"), false);
});
test("requiresCodingReview returns false for plan task type", () => {
    assert.equal(requiresCodingReview("plan"), false);
});
test("requiresCodingReview returns false for test task type", () => {
    assert.equal(requiresCodingReview("test"), false);
});
test("requiresCodingReview returns false for review task type (self-review)", () => {
    assert.equal(requiresCodingReview("review"), false);
});
//# sourceMappingURL=index.test.js.map