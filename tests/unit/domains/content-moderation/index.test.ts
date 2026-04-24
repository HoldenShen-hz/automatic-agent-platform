import assert from "node:assert/strict";
import test from "node:test";

import {
  ContentModerationTaskTypeSchema,
  CONTENT_MODERATION_DOMAIN_PRESET,
  ContentModerationDomainPreset,
  requiresContentModerationReview,
} from "../../../../src/domains/content-moderation/index.js";

test("ContentModerationTaskTypeSchema accepts valid task types", () => {
  const types = ["classify", "moderate", "escalate"] as const;
  for (const type of types) {
    const result = ContentModerationTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("ContentModerationTaskTypeSchema rejects invalid task types", () => {
  const result = ContentModerationTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("CONTENT_MODERATION_DOMAIN_PRESET has correct structure", () => {
  assert.equal(CONTENT_MODERATION_DOMAIN_PRESET.domainId, "content-moderation");
  assert.ok(Array.isArray(CONTENT_MODERATION_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(CONTENT_MODERATION_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(CONTENT_MODERATION_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(CONTENT_MODERATION_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("CONTENT_MODERATION_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(CONTENT_MODERATION_DOMAIN_PRESET.requiredCapabilities, ["classify", "moderate", "escalate"]);
});

test("CONTENT_MODERATION_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(CONTENT_MODERATION_DOMAIN_PRESET.reviewRequiredTaskTypes, ["moderate", "escalate"]);
});

test("requiresContentModerationReview returns true for moderate task type", () => {
  assert.equal(requiresContentModerationReview("moderate"), true);
});

test("requiresContentModerationReview returns true for escalate task type", () => {
  assert.equal(requiresContentModerationReview("escalate"), true);
});

test("requiresContentModerationReview returns false for classify task type", () => {
  assert.equal(requiresContentModerationReview("classify"), false);
});
