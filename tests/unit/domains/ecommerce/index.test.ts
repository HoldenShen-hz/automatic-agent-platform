import assert from "node:assert/strict";
import test from "node:test";

import {
  EcommerceTaskTypeSchema,
  ECOMMERCE_DOMAIN_PRESET,
  requiresEcommerceReview,
} from "../../../../src/domains/ecommerce/index.js";

test("EcommerceTaskTypeSchema accepts valid task types", () => {
  const types = ["catalog", "pricing", "order"] as const;
  for (const type of types) {
    const result = EcommerceTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("EcommerceTaskTypeSchema rejects invalid task types", () => {
  const result = EcommerceTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("ECOMMERCE_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(ECOMMERCE_DOMAIN_PRESET.domainId, "ecommerce");
});

test("ECOMMERCE_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(ECOMMERCE_DOMAIN_PRESET.displayName, "Ecommerce");
});

test("ECOMMERCE_DOMAIN_PRESET has correct task types", () => {
  assert.deepEqual(ECOMMERCE_DOMAIN_PRESET.requiredCapabilities, ["catalog", "pricing", "order"]);
});

test("ECOMMERCE_DOMAIN_PRESET reviewRequiredTaskTypes includes pricing and order", () => {
  assert.deepEqual(ECOMMERCE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["pricing", "order"]);
});

test("requiresEcommerceReview returns true for pricing task type", () => {
  assert.equal(requiresEcommerceReview("pricing"), true);
});

test("requiresEcommerceReview returns true for order task type", () => {
  assert.equal(requiresEcommerceReview("order"), true);
});

test("requiresEcommerceReview returns false for catalog task type", () => {
  assert.equal(requiresEcommerceReview("catalog"), false);
});
