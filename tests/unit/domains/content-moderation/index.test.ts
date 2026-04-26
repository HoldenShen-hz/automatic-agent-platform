import assert from "node:assert/strict";
import test from "node:test";

import {
  ContentModerationTaskTypeSchema,
  CONTENT_MODERATION_DOMAIN_PRESET,
  requiresContentModerationReview,
  type ContentModerationTaskType,
} from "../../../../src/domains/content-moderation/index.js";

test("ContentModerationTaskTypeSchema accepts valid task types", () => {
  assert.equal(ContentModerationTaskTypeSchema.parse("classify"), "classify");
  assert.equal(ContentModerationTaskTypeSchema.parse("moderate"), "moderate");
  assert.equal(ContentModerationTaskTypeSchema.parse("escalate"), "escalate");
});

test("ContentModerationTaskTypeSchema rejects invalid task types", () => {
  assert.throws(() => ContentModerationTaskTypeSchema.parse("invalid"));
});

test("CONTENT_MODERATION_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(CONTENT_MODERATION_DOMAIN_PRESET.domainId, "content-moderation");
});

test("CONTENT_MODERATION_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(CONTENT_MODERATION_DOMAIN_PRESET.displayName, "Content Moderation");
});

test("CONTENT_MODERATION_DOMAIN_PRESET has requiredCapabilities", () => {
  assert.deepEqual(CONTENT_MODERATION_DOMAIN_PRESET.requiredCapabilities, ["classify", "moderate", "escalate"]);
});

test("CONTENT_MODERATION_DOMAIN_PRESET has reviewRequiredTaskTypes", () => {
  assert.deepEqual(CONTENT_MODERATION_DOMAIN_PRESET.reviewRequiredTaskTypes, ["moderate", "escalate"]);
});

test("CONTENT_MODERATION_DOMAIN_PRESET has defaultWorkflowIds", () => {
  assert.ok(Array.isArray(CONTENT_MODERATION_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(CONTENT_MODERATION_DOMAIN_PRESET.defaultWorkflowIds.length > 0);
});

test("CONTENT_MODERATION_DOMAIN_PRESET has defaultToolBundleIds", () => {
  assert.ok(Array.isArray(CONTENT_MODERATION_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(CONTENT_MODERATION_DOMAIN_PRESET.defaultToolBundleIds.length > 0);
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

test("CONTENT_MODERATION_DOMAIN_PRESET is frozen and immutable", () => {
  assert.ok(Object.isFrozen(CONTENT_MODERATION_DOMAIN_PRESET));
  assert.ok(Object.isFrozen(CONTENT_MODERATION_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Object.isFrozen(CONTENT_MODERATION_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
