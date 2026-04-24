import assert from "node:assert/strict";
import test from "node:test";

import {
  AcademicResearchTaskTypeSchema,
  ACADEMIC_RESEARCH_DOMAIN_PRESET,
  requiresAcademicResearchReview,
} from "../../../../src/domains/academic-research/index.js";

test("AcademicResearchTaskTypeSchema accepts valid task types", () => {
  const types = ["collect", "evaluate", "synthesize"] as const;
  for (const type of types) {
    const result = AcademicResearchTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("AcademicResearchTaskTypeSchema rejects invalid task types", () => {
  const result = AcademicResearchTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("ACADEMIC_RESEARCH_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(ACADEMIC_RESEARCH_DOMAIN_PRESET.domainId, "academic-research");
});

test("ACADEMIC_RESEARCH_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(ACADEMIC_RESEARCH_DOMAIN_PRESET.displayName, "Academic Research");
});

test("ACADEMIC_RESEARCH_DOMAIN_PRESET has correct task types", () => {
  assert.deepEqual(ACADEMIC_RESEARCH_DOMAIN_PRESET.requiredCapabilities, ["collect", "evaluate", "synthesize"]);
});

test("ACADEMIC_RESEARCH_DOMAIN_PRESET reviewRequiredTaskTypes includes evaluate and synthesize", () => {
  assert.deepEqual(ACADEMIC_RESEARCH_DOMAIN_PRESET.reviewRequiredTaskTypes, ["evaluate", "synthesize"]);
});

test("requiresAcademicResearchReview returns true for evaluate task type", () => {
  assert.equal(requiresAcademicResearchReview("evaluate"), true);
});

test("requiresAcademicResearchReview returns true for synthesize task type", () => {
  assert.equal(requiresAcademicResearchReview("synthesize"), true);
});

test("requiresAcademicResearchReview returns false for collect task type", () => {
  assert.equal(requiresAcademicResearchReview("collect"), false);
});
