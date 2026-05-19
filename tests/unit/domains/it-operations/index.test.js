import assert from "node:assert/strict";
import test from "node:test";
import { ItOperationsTaskTypeSchema, IT_OPERATIONS_DOMAIN_PRESET, requiresItOperationsReview, } from "../../../../src/domains/it-operations/index.js";
test("ItOperationsTaskTypeSchema accepts valid task types", () => {
    assert.equal(ItOperationsTaskTypeSchema.parse("detect"), "detect");
    assert.equal(ItOperationsTaskTypeSchema.parse("mitigate"), "mitigate");
    assert.equal(ItOperationsTaskTypeSchema.parse("recover"), "recover");
});
test("ItOperationsTaskTypeSchema rejects invalid task types", () => {
    assert.throws(() => ItOperationsTaskTypeSchema.parse("invalid"));
});
test("IT_OPERATIONS_DOMAIN_PRESET has correct domainId", () => {
    assert.equal(IT_OPERATIONS_DOMAIN_PRESET.domainId, "it-operations");
});
test("IT_OPERATIONS_DOMAIN_PRESET has correct displayName", () => {
    assert.equal(IT_OPERATIONS_DOMAIN_PRESET.displayName, "IT Operations");
});
test("IT_OPERATIONS_DOMAIN_PRESET has requiredCapabilities", () => {
    assert.deepEqual(IT_OPERATIONS_DOMAIN_PRESET.requiredCapabilities, ["detect", "mitigate", "recover"]);
});
test("IT_OPERATIONS_DOMAIN_PRESET has reviewRequiredTaskTypes", () => {
    assert.deepEqual(IT_OPERATIONS_DOMAIN_PRESET.reviewRequiredTaskTypes, ["mitigate", "recover"]);
});
test("IT_OPERATIONS_DOMAIN_PRESET has defaultWorkflowIds", () => {
    assert.ok(Array.isArray(IT_OPERATIONS_DOMAIN_PRESET.defaultWorkflowIds));
    assert.ok(IT_OPERATIONS_DOMAIN_PRESET.defaultWorkflowIds.length > 0);
});
test("IT_OPERATIONS_DOMAIN_PRESET has defaultToolBundleIds", () => {
    assert.ok(Array.isArray(IT_OPERATIONS_DOMAIN_PRESET.defaultToolBundleIds));
    assert.ok(IT_OPERATIONS_DOMAIN_PRESET.defaultToolBundleIds.length > 0);
});
test("requiresItOperationsReview returns true for mitigate task type", () => {
    assert.equal(requiresItOperationsReview("mitigate"), true);
});
test("requiresItOperationsReview returns true for recover task type", () => {
    assert.equal(requiresItOperationsReview("recover"), true);
});
test("requiresItOperationsReview returns false for detect task type", () => {
    assert.equal(requiresItOperationsReview("detect"), false);
});
test("IT_OPERATIONS_DOMAIN_PRESET is frozen and immutable", () => {
    assert.ok(Object.isFrozen(IT_OPERATIONS_DOMAIN_PRESET));
    assert.ok(Object.isFrozen(IT_OPERATIONS_DOMAIN_PRESET.requiredCapabilities));
    assert.ok(Object.isFrozen(IT_OPERATIONS_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
//# sourceMappingURL=index.test.js.map