import assert from "node:assert/strict";
import test from "node:test";

import {
  ManufacturingTaskTypeSchema,
  MANUFACTURING_DOMAIN_PRESET,
  ManufacturingDomainPreset,
  requiresManufacturingReview,
} from "../../../../src/domains/manufacturing/index.js";

test("ManufacturingTaskTypeSchema accepts valid task types", () => {
  const types = ["plan", "monitor", "correct"] as const;
  for (const type of types) {
    const result = ManufacturingTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("ManufacturingTaskTypeSchema rejects invalid task types", () => {
  const result = ManufacturingTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("MANUFACTURING_DOMAIN_PRESET has correct structure", () => {
  assert.equal(MANUFACTURING_DOMAIN_PRESET.domainId, "manufacturing");
  assert.ok(Array.isArray(MANUFACTURING_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(MANUFACTURING_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(MANUFACTURING_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(MANUFACTURING_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("MANUFACTURING_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(MANUFACTURING_DOMAIN_PRESET.requiredCapabilities, ["plan", "monitor", "correct"]);
});

test("MANUFACTURING_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(MANUFACTURING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["monitor", "correct"]);
});

test("requiresManufacturingReview returns true for monitor task type", () => {
  assert.equal(requiresManufacturingReview("monitor"), true);
});

test("requiresManufacturingReview returns true for correct task type", () => {
  assert.equal(requiresManufacturingReview("correct"), true);
});

test("requiresManufacturingReview returns false for plan task type", () => {
  assert.equal(requiresManufacturingReview("plan"), false);
});
