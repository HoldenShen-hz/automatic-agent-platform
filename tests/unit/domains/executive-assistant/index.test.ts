import assert from "node:assert/strict";
import test from "node:test";

import {
  ExecutiveAssistantTaskTypeSchema,
  EXECUTIVE_ASSISTANT_DOMAIN_PRESET,
  ExecutiveAssistantDomainPreset,
  requiresExecutiveAssistantReview,
} from "../../../../src/domains/executive-assistant/index.js";

test("ExecutiveAssistantTaskTypeSchema accepts valid task types", () => {
  const types = ["schedule", "brief", "follow-up"] as const;
  for (const type of types) {
    const result = ExecutiveAssistantTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("ExecutiveAssistantTaskTypeSchema rejects invalid task types", () => {
  const result = ExecutiveAssistantTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("EXECUTIVE_ASSISTANT_DOMAIN_PRESET has correct structure", () => {
  assert.equal(EXECUTIVE_ASSISTANT_DOMAIN_PRESET.domainId, "executive-assistant");
  assert.ok(Array.isArray(EXECUTIVE_ASSISTANT_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(EXECUTIVE_ASSISTANT_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(EXECUTIVE_ASSISTANT_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(EXECUTIVE_ASSISTANT_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("EXECUTIVE_ASSISTANT_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(EXECUTIVE_ASSISTANT_DOMAIN_PRESET.requiredCapabilities, ["schedule", "brief", "follow-up"]);
});

test("EXECUTIVE_ASSISTANT_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(EXECUTIVE_ASSISTANT_DOMAIN_PRESET.reviewRequiredTaskTypes, ["brief", "follow-up"]);
});

test("requiresExecutiveAssistantReview returns true for brief task type", () => {
  assert.equal(requiresExecutiveAssistantReview("brief"), true);
});

test("requiresExecutiveAssistantReview returns true for follow-up task type", () => {
  assert.equal(requiresExecutiveAssistantReview("follow-up"), true);
});

test("requiresExecutiveAssistantReview returns false for schedule task type", () => {
  assert.equal(requiresExecutiveAssistantReview("schedule"), false);
});
