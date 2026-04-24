import assert from "node:assert/strict";
import test from "node:test";

import {
  MarketingTaskTypeSchema,
  MARKETING_DOMAIN_PRESET,
  MarketingDomainPreset,
  requiresMarketingReview,
} from "../../../../src/domains/marketing/index.js";

test("MarketingTaskTypeSchema accepts valid task types", () => {
  const types = ["plan", "publish", "measure"] as const;
  for (const type of types) {
    const result = MarketingTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("MarketingTaskTypeSchema rejects invalid task types", () => {
  const result = MarketingTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("MARKETING_DOMAIN_PRESET has correct structure", () => {
  assert.equal(MARKETING_DOMAIN_PRESET.domainId, "marketing");
  assert.ok(Array.isArray(MARKETING_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(MARKETING_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(MARKETING_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(MARKETING_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("MARKETING_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(MARKETING_DOMAIN_PRESET.requiredCapabilities, ["plan", "publish", "measure"]);
});

test("MARKETING_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(MARKETING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["publish", "measure"]);
});

test("requiresMarketingReview returns true for publish task type", () => {
  assert.equal(requiresMarketingReview("publish"), true);
});

test("requiresMarketingReview returns true for measure task type", () => {
  assert.equal(requiresMarketingReview("measure"), true);
});

test("requiresMarketingReview returns false for plan task type", () => {
  assert.equal(requiresMarketingReview("plan"), false);
});
