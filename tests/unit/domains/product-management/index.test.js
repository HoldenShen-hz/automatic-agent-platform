import assert from "node:assert/strict";
import test from "node:test";
import { ProductManagementTaskTypeSchema, PRODUCT_MANAGEMENT_DOMAIN_PRESET, requiresProductManagementReview, } from "../../../../src/domains/product-management/index.js";
test("ProductManagementTaskTypeSchema accepts valid task types", () => {
    const types = ["discover", "prioritize", "specify"];
    for (const type of types) {
        const result = ProductManagementTaskTypeSchema.safeParse(type);
        assert.equal(result.success, true, `Expected ${type} to be valid`);
    }
});
test("ProductManagementTaskTypeSchema rejects invalid task types", () => {
    const result = ProductManagementTaskTypeSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("PRODUCT_MANAGEMENT_DOMAIN_PRESET has correct domainId", () => {
    assert.equal(PRODUCT_MANAGEMENT_DOMAIN_PRESET.domainId, "product-management");
});
test("PRODUCT_MANAGEMENT_DOMAIN_PRESET has correct displayName", () => {
    assert.equal(PRODUCT_MANAGEMENT_DOMAIN_PRESET.displayName, "Product Management");
});
test("PRODUCT_MANAGEMENT_DOMAIN_PRESET has correct task types", () => {
    assert.deepEqual(PRODUCT_MANAGEMENT_DOMAIN_PRESET.requiredCapabilities, ["discover", "prioritize", "specify"]);
});
test("PRODUCT_MANAGEMENT_DOMAIN_PRESET reviewRequiredTaskTypes includes prioritize and specify", () => {
    assert.deepEqual(PRODUCT_MANAGEMENT_DOMAIN_PRESET.reviewRequiredTaskTypes, ["prioritize", "specify"]);
});
test("requiresProductManagementReview returns true for prioritize task type", () => {
    assert.equal(requiresProductManagementReview("prioritize"), true);
});
test("requiresProductManagementReview returns true for specify task type", () => {
    assert.equal(requiresProductManagementReview("specify"), true);
});
test("requiresProductManagementReview returns false for discover task type", () => {
    assert.equal(requiresProductManagementReview("discover"), false);
});
//# sourceMappingURL=index.test.js.map