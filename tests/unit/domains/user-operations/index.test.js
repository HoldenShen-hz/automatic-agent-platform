import assert from "node:assert/strict";
import test from "node:test";
import { UserOperationsTaskTypeSchema, USER_OPERATIONS_DOMAIN_PRESET, requiresUserOperationsReview, } from "../../../../src/domains/user-operations/index.js";
test("UserOperationsTaskTypeSchema accepts valid task types", () => {
    const types = ["segment", "operate", "follow-up"];
    for (const type of types) {
        const result = UserOperationsTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("UserOperationsTaskTypeSchema rejects invalid task types", () => {
    const result = UserOperationsTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("USER_OPERATIONS_DOMAIN_PRESET has correct domainId", () => {
    assert.equal(USER_OPERATIONS_DOMAIN_PRESET.domainId, "user-operations");
});
test("USER_OPERATIONS_DOMAIN_PRESET has correct displayName", () => {
    assert.equal(USER_OPERATIONS_DOMAIN_PRESET.displayName, "User Operations");
});
test("USER_OPERATIONS_DOMAIN_PRESET has correct task types", () => {
    assert.deepEqual(USER_OPERATIONS_DOMAIN_PRESET.requiredCapabilities, ["segment", "operate", "follow-up"]);
});
test("USER_OPERATIONS_DOMAIN_PRESET reviewRequiredTaskTypes includes operate and follow-up", () => {
    assert.deepEqual(USER_OPERATIONS_DOMAIN_PRESET.reviewRequiredTaskTypes, ["operate", "follow-up"]);
});
test("requiresUserOperationsReview returns true for operate task type", () => {
    assert.equal(requiresUserOperationsReview("operate"), true);
});
test("requiresUserOperationsReview returns true for follow-up task type", () => {
    assert.equal(requiresUserOperationsReview("follow-up"), true);
});
test("requiresUserOperationsReview returns false for segment task type", () => {
    assert.equal(requiresUserOperationsReview("segment"), false);
});
//# sourceMappingURL=index.test.js.map