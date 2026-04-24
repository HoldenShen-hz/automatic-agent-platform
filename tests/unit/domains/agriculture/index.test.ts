import assert from "node:assert/strict";
import test from "node:test";

import {
  AgricultureTaskTypeSchema,
  AGRICULTURE_DOMAIN_PRESET,
  AgricultureDomainPreset,
  requiresAgricultureReview,
} from "../../../../src/domains/agriculture/index.js";

test("AgricultureTaskTypeSchema accepts valid task types", () => {
  const types = ["plan", "monitor", "recommend"] as const;
  for (const type of types) {
    const result = AgricultureTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("AgricultureTaskTypeSchema rejects invalid task types", () => {
  const result = AgricultureTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("AGRICULTURE_DOMAIN_PRESET has correct structure", () => {
  assert.equal(AGRICULTURE_DOMAIN_PRESET.domainId, "agriculture");
  assert.ok(Array.isArray(AGRICULTURE_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(AGRICULTURE_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(AGRICULTURE_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(AGRICULTURE_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("AGRICULTURE_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(AGRICULTURE_DOMAIN_PRESET.requiredCapabilities, ["plan", "monitor", "recommend"]);
});

test("AGRICULTURE_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(AGRICULTURE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["monitor", "recommend"]);
});

test("requiresAgricultureReview returns true for monitor task type", () => {
  assert.equal(requiresAgricultureReview("monitor"), true);
});

test("requiresAgricultureReview returns true for recommend task type", () => {
  assert.equal(requiresAgricultureReview("recommend"), true);
});

test("requiresAgricultureReview returns false for plan task type", () => {
  assert.equal(requiresAgricultureReview("plan"), false);
});
