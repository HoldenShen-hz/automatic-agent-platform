import assert from "node:assert/strict";
import test from "node:test";

import {
  QualityAssuranceTaskTypeSchema,
  QUALITY_ASSURANCE_DOMAIN_PRESET,
  requiresQualityAssuranceReview,
} from "../../../../src/domains/quality-assurance/index.js";

test("QualityAssuranceTaskTypeSchema accepts valid task types", () => {
  const types = ["design", "validate", "certify"] as const;
  for (const type of types) {
    const result = QualityAssuranceTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("QualityAssuranceTaskTypeSchema rejects invalid task types", () => {
  const result = QualityAssuranceTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("QUALITY_ASSURANCE_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(QUALITY_ASSURANCE_DOMAIN_PRESET.domainId, "quality-assurance");
});

test("QUALITY_ASSURANCE_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(QUALITY_ASSURANCE_DOMAIN_PRESET.displayName, "Quality Assurance");
});

test("QUALITY_ASSURANCE_DOMAIN_PRESET has correct task types", () => {
  assert.deepEqual(QUALITY_ASSURANCE_DOMAIN_PRESET.requiredCapabilities, ["design", "validate", "certify"]);
});

test("QUALITY_ASSURANCE_DOMAIN_PRESET reviewRequiredTaskTypes includes validate and certify", () => {
  assert.deepEqual(QUALITY_ASSURANCE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["validate", "certify"]);
});

test("requiresQualityAssuranceReview returns true for validate task type", () => {
  assert.equal(requiresQualityAssuranceReview("validate"), true);
});

test("requiresQualityAssuranceReview returns true for certify task type", () => {
  assert.equal(requiresQualityAssuranceReview("certify"), true);
});

test("requiresQualityAssuranceReview returns false for design task type", () => {
  assert.equal(requiresQualityAssuranceReview("design"), false);
});
