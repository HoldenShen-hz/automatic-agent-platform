import assert from "node:assert/strict";
import test from "node:test";
import { EducationTaskTypeSchema, EDUCATION_DOMAIN_PRESET, requiresEducationReview, } from "../../../../src/domains/education/index.js";
test("EducationTaskTypeSchema accepts valid task types", () => {
    const types = ["design", "coach", "assess"];
    for (const type of types) {
        const result = EducationTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("EducationTaskTypeSchema rejects invalid task types", () => {
    const result = EducationTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("EDUCATION_DOMAIN_PRESET has correct structure", () => {
    assert.equal(EDUCATION_DOMAIN_PRESET.domainId, "education");
    assert.ok(Array.isArray(EDUCATION_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(Array.isArray(EDUCATION_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(Array.isArray(EDUCATION_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Array.isArray(EDUCATION_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
test("EDUCATION_DOMAIN_PRESET has correct required capabilities", () => {
    assert.deepEqual(EDUCATION_DOMAIN_PRESET.requiredCapabilities, ["design", "coach", "assess"]);
});
test("EDUCATION_DOMAIN_PRESET has correct review required task types", () => {
    assert.deepEqual(EDUCATION_DOMAIN_PRESET.reviewRequiredTaskTypes, ["coach", "assess"]);
});
test("requiresEducationReview returns true for coach task type", () => {
    assert.equal(requiresEducationReview("coach"), true);
});
test("requiresEducationReview returns true for assess task type", () => {
    assert.equal(requiresEducationReview("assess"), true);
});
test("requiresEducationReview returns false for design task type", () => {
    assert.equal(requiresEducationReview("design"), false);
});
//# sourceMappingURL=index.test.js.map