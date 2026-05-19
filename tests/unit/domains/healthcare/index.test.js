import assert from "node:assert/strict";
import test from "node:test";
import { HealthcareTaskTypeSchema, HEALTHCARE_DOMAIN_PRESET, requiresHealthcareReview, } from "../../../../src/domains/healthcare/index.js";
test("HealthcareTaskTypeSchema accepts valid task types", () => {
    assert.equal(HealthcareTaskTypeSchema.parse("triage"), "triage");
    assert.equal(HealthcareTaskTypeSchema.parse("summarize"), "summarize");
    assert.equal(HealthcareTaskTypeSchema.parse("coordinate"), "coordinate");
});
test("HealthcareTaskTypeSchema rejects invalid task types", () => {
    assert.throws(() => HealthcareTaskTypeSchema.parse("invalid"));
});
test("HEALTHCARE_DOMAIN_PRESET has correct domainId", () => {
    assert.equal(HEALTHCARE_DOMAIN_PRESET.domainId, "healthcare");
});
test("HEALTHCARE_DOMAIN_PRESET has correct displayName", () => {
    assert.equal(HEALTHCARE_DOMAIN_PRESET.displayName, "Healthcare");
});
test("HEALTHCARE_DOMAIN_PRESET has requiredCapabilities", () => {
    assert.deepEqual(HEALTHCARE_DOMAIN_PRESET.requiredCapabilities, ["triage", "summarize", "coordinate"]);
});
test("HEALTHCARE_DOMAIN_PRESET has reviewRequiredTaskTypes", () => {
    assert.deepEqual(HEALTHCARE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["summarize", "coordinate"]);
});
test("HEALTHCARE_DOMAIN_PRESET has defaultWorkflowIds", () => {
    assert.ok(Array.isArray(HEALTHCARE_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(HEALTHCARE_DOMAIN_PRESET.defaultWorkflowIds.length > 0);
});
test("HEALTHCARE_DOMAIN_PRESET has defaultToolBundleIds", () => {
    assert.ok(Array.isArray(HEALTHCARE_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(HEALTHCARE_DOMAIN_PRESET.defaultToolBundleIds.length > 0);
});
test("requiresHealthcareReview returns true for summarize task type", () => {
    assert.equal(requiresHealthcareReview("summarize"), true);
});
test("requiresHealthcareReview returns true for coordinate task type", () => {
    assert.equal(requiresHealthcareReview("coordinate"), true);
});
test("requiresHealthcareReview returns false for triage task type", () => {
    assert.equal(requiresHealthcareReview("triage"), false);
});
test("HEALTHCARE_DOMAIN_PRESET is frozen and immutable", () => {
    assert.ok(Object.isFrozen(HEALTHCARE_DOMAIN_PRESET));
    assert.ok(Object.isFrozen(HEALTHCARE_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Object.isFrozen(HEALTHCARE_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
//# sourceMappingURL=index.test.js.map