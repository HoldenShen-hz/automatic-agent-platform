import assert from "node:assert/strict";
import test from "node:test";

import {
  HumanResourcesTaskTypeSchema,
  HUMAN_RESOURCES_DOMAIN_PRESET,
  HumanResourcesDomainPreset,
  requiresHumanResourcesReview,
} from "../../../../src/domains/human-resources/index.js";

test("HumanResourcesTaskTypeSchema accepts valid task types", () => {
  const types = ["screen", "review", "coordinate"] as const;
  for (const type of types) {
    const result = HumanResourcesTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("HumanResourcesTaskTypeSchema rejects invalid task types", () => {
  const result = HumanResourcesTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("HUMAN_RESOURCES_DOMAIN_PRESET has correct structure", () => {
  assert.equal(HUMAN_RESOURCES_DOMAIN_PRESET.domainId, "human-resources");
  assert.ok(Array.isArray(HUMAN_RESOURCES_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(HUMAN_RESOURCES_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(HUMAN_RESOURCES_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(HUMAN_RESOURCES_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("HUMAN_RESOURCES_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(HUMAN_RESOURCES_DOMAIN_PRESET.requiredCapabilities, ["screen", "review", "coordinate"]);
});

test("HUMAN_RESOURCES_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(HUMAN_RESOURCES_DOMAIN_PRESET.reviewRequiredTaskTypes, ["review", "coordinate"]);
});

test("requiresHumanResourcesReview returns true for review task type", () => {
  assert.equal(requiresHumanResourcesReview("review"), true);
});

test("requiresHumanResourcesReview returns true for coordinate task type", () => {
  assert.equal(requiresHumanResourcesReview("coordinate"), true);
});

test("requiresHumanResourcesReview returns false for screen task type", () => {
  assert.equal(requiresHumanResourcesReview("screen"), false);
});
