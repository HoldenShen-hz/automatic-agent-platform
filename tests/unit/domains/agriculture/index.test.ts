import assert from "node:assert/strict";
import test from "node:test";

import {
  AgricultureTaskTypeSchema,
  AGRICULTURE_DOMAIN_PRESET,
  requiresAgricultureReview,
  type AgricultureTaskType,
} from "../../../../src/domains/agriculture/index.js";

test("AgricultureTaskTypeSchema accepts valid task types", () => {
  assert.equal(AgricultureTaskTypeSchema.parse("plan"), "plan");
  assert.equal(AgricultureTaskTypeSchema.parse("monitor"), "monitor");
  assert.equal(AgricultureTaskTypeSchema.parse("recommend"), "recommend");
});

test("AgricultureTaskTypeSchema rejects invalid task types", () => {
  assert.throws(() => AgricultureTaskTypeSchema.parse("invalid"));
});

test("AGRICULTURE_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(AGRICULTURE_DOMAIN_PRESET.domainId, "agriculture");
});

test("AGRICULTURE_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(AGRICULTURE_DOMAIN_PRESET.displayName, "Agriculture");
});

test("AGRICULTURE_DOMAIN_PRESET has requiredCapabilities", () => {
  assert.deepEqual(AGRICULTURE_DOMAIN_PRESET.requiredCapabilities, ["plan", "monitor", "recommend"]);
});

test("AGRICULTURE_DOMAIN_PRESET has reviewRequiredTaskTypes", () => {
  assert.deepEqual(AGRICULTURE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["monitor", "recommend"]);
});

test("AGRICULTURE_DOMAIN_PRESET has defaultWorkflowIds", () => {
  assert.ok(Array.isArray(AGRICULTURE_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(AGRICULTURE_DOMAIN_PRESET.defaultWorkflowIds.length > 0);
});

test("AGRICULTURE_DOMAIN_PRESET has defaultToolBundleIds", () => {
  assert.ok(Array.isArray(AGRICULTURE_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(AGRICULTURE_DOMAIN_PRESET.defaultToolBundleIds.length > 0);
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

test("AGRICULTURE_DOMAIN_PRESET is frozen and immutable", () => {
  assert.ok(Object.isFrozen(AGRICULTURE_DOMAIN_PRESET));
  assert.ok(Object.isFrozen(AGRICULTURE_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Object.isFrozen(AGRICULTURE_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
