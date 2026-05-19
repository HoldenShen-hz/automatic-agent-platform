import assert from "node:assert/strict";
import test from "node:test";
import { FacilitiesTaskTypeSchema, FACILITIES_DOMAIN_PRESET, requiresFacilitiesReview, } from "../../../../src/domains/facilities/index.js";
test("FacilitiesTaskTypeSchema accepts valid task types", () => {
    const types = ["dispatch", "inspect", "coordinate"];
    for (const type of types) {
        const result = FacilitiesTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("FacilitiesTaskTypeSchema rejects invalid task types", () => {
    const result = FacilitiesTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("FACILITIES_DOMAIN_PRESET has correct structure", () => {
    assert.equal(FACILITIES_DOMAIN_PRESET.domainId, "facilities");
    assert.ok(Array.isArray(FACILITIES_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(Array.isArray(FACILITIES_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(Array.isArray(FACILITIES_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Array.isArray(FACILITIES_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
test("FACILITIES_DOMAIN_PRESET has correct required capabilities", () => {
    assert.deepEqual(FACILITIES_DOMAIN_PRESET.requiredCapabilities, ["dispatch", "inspect", "coordinate"]);
});
test("FACILITIES_DOMAIN_PRESET has correct review required task types", () => {
    assert.deepEqual(FACILITIES_DOMAIN_PRESET.reviewRequiredTaskTypes, ["inspect", "coordinate"]);
});
test("requiresFacilitiesReview returns true for inspect task type", () => {
    assert.equal(requiresFacilitiesReview("inspect"), true);
});
test("requiresFacilitiesReview returns true for coordinate task type", () => {
    assert.equal(requiresFacilitiesReview("coordinate"), true);
});
test("requiresFacilitiesReview returns false for dispatch task type", () => {
    assert.equal(requiresFacilitiesReview("dispatch"), false);
});
//# sourceMappingURL=index.test.js.map