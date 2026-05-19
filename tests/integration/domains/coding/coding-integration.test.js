import assert from "node:assert/strict";
import test from "node:test";
import { CODING_DOMAIN_PRESET, requiresCodingReview, } from "../../../../src/domains/coding/index.js";
test("integration: CODING_DOMAIN_PRESET has correct domainId", () => {
    assert.equal(CODING_DOMAIN_PRESET.domainId, "coding");
});
test("integration: CODING_DOMAIN_PRESET has required capabilities", () => {
    assert.ok(CODING_DOMAIN_PRESET.requiredCapabilities.includes("analyze"));
    assert.ok(CODING_DOMAIN_PRESET.requiredCapabilities.includes("implement"));
    assert.ok(CODING_DOMAIN_PRESET.requiredCapabilities.includes("test"));
});
test("integration: requiresCodingReview returns true for implement and release", () => {
    const reviewRequired = ["implement", "release"];
    for (const taskType of reviewRequired) {
        assert.equal(requiresCodingReview(taskType), true, `${taskType} should require review`);
    }
});
test("integration: requiresCodingReview returns false for other task types", () => {
    const noReviewRequired = ["analyze", "plan", "test", "review"];
    for (const taskType of noReviewRequired) {
        assert.equal(requiresCodingReview(taskType), false, `${taskType} should not require review`);
    }
});
test("integration: CODING_DOMAIN_PRESET has correct default tool bundles", () => {
    assert.ok(CODING_DOMAIN_PRESET.defaultToolBundleIds.includes("repo_tools"));
    assert.ok(CODING_DOMAIN_PRESET.defaultToolBundleIds.includes("build_tools"));
    assert.ok(CODING_DOMAIN_PRESET.defaultToolBundleIds.includes("test_tools"));
});
test("integration: CODING_DOMAIN_PRESET has correct default workflow IDs", () => {
    assert.ok(CODING_DOMAIN_PRESET.defaultWorkflowIds.includes("coding_change"));
});
test("integration: All coding task types are valid", () => {
    const validTypes = ["analyze", "plan", "implement", "test", "review", "release"];
    for (const taskType of validTypes) {
        assert.ok(CODING_DOMAIN_PRESET.reviewRequiredTaskTypes.includes(taskType) ||
            !requiresCodingReview(taskType), `${taskType} is a valid task type`);
    }
});
//# sourceMappingURL=coding-integration.test.js.map