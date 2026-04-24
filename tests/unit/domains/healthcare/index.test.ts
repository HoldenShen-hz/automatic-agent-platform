import assert from "node:assert/strict";
import test from "node:test";

import {
  HealthcareTaskTypeSchema,
  HEALTHCARE_DOMAIN_PRESET,
  HealthcareDomainPreset,
  requiresHealthcareReview,
} from "../../../../src/domains/healthcare/index.js";

test("HealthcareTaskTypeSchema accepts valid task types", () => {
  const types = ["triage", "summarize", "coordinate"] as const;
  for (const type of types) {
    const result = HealthcareTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("HealthcareTaskTypeSchema rejects invalid task types", () => {
  const result = HealthcareTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("HEALTHCARE_DOMAIN_PRESET has correct structure", () => {
  assert.equal(HEALTHCARE_DOMAIN_PRESET.domainId, "healthcare");
  assert.ok(Array.isArray(HEALTHCARE_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(HEALTHCARE_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(HEALTHCARE_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(HEALTHCARE_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("HEALTHCARE_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(HEALTHCARE_DOMAIN_PRESET.requiredCapabilities, ["triage", "summarize", "coordinate"]);
});

test("HEALTHCARE_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(HEALTHCARE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["summarize", "coordinate"]);
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
