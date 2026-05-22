import assert from "node:assert/strict";
import test from "node:test";

import {
  LegalTaskTypeSchema,
  LEGAL_DOMAIN_PRESET,
  LegalDomainPreset,
  requiresAttorneyReview,
  requiresLegalReview,
} from "../../../../src/domains/legal/index.js";

test("LegalTaskTypeSchema accepts valid task types", () => {
  const types = ["review", "redline", "advise"] as const;
  for (const type of types) {
    const result = LegalTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("LegalTaskTypeSchema rejects invalid task types", () => {
  const result = LegalTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("LEGAL_DOMAIN_PRESET has correct structure", () => {
  assert.equal(LEGAL_DOMAIN_PRESET.domainId, "legal");
  assert.ok(Array.isArray(LEGAL_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(LEGAL_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(LEGAL_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(LEGAL_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("LEGAL_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(LEGAL_DOMAIN_PRESET.requiredCapabilities, ["review", "redline", "advise"]);
});

test("LEGAL_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(LEGAL_DOMAIN_PRESET.reviewRequiredTaskTypes, ["review", "redline", "advise"]);
});

test("requiresLegalReview returns true for redline task type", () => {
  assert.equal(requiresLegalReview("redline"), true);
});

test("requiresLegalReview returns true for advise task type", () => {
  assert.equal(requiresLegalReview("advise"), true);
});

test("requiresLegalReview returns true for review task type", () => {
  assert.equal(requiresLegalReview("review"), true);
});

test("requiresAttorneyReview matches legal review policy for all legal task types", () => {
  assert.equal(requiresAttorneyReview("review"), true);
  assert.equal(requiresAttorneyReview("redline"), true);
  assert.equal(requiresAttorneyReview("advise"), true);
});
