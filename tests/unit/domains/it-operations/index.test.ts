import assert from "node:assert/strict";
import test from "node:test";

import {
  ItOperationsTaskTypeSchema,
  IT_OPERATIONS_DOMAIN_PRESET,
  ItOperationsDomainPreset,
  requiresItOperationsReview,
} from "../../../../src/domains/it-operations/index.js";

test("ItOperationsTaskTypeSchema accepts valid task types", () => {
  const types = ["detect", "mitigate", "recover"] as const;
  for (const type of types) {
    const result = ItOperationsTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("ItOperationsTaskTypeSchema rejects invalid task types", () => {
  const result = ItOperationsTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("IT_OPERATIONS_DOMAIN_PRESET has correct structure", () => {
  assert.equal(IT_OPERATIONS_DOMAIN_PRESET.domainId, "it-operations");
  assert.ok(Array.isArray(IT_OPERATIONS_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(IT_OPERATIONS_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(IT_OPERATIONS_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(IT_OPERATIONS_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("IT_OPERATIONS_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(IT_OPERATIONS_DOMAIN_PRESET.requiredCapabilities, ["detect", "mitigate", "recover"]);
});

test("IT_OPERATIONS_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(IT_OPERATIONS_DOMAIN_PRESET.reviewRequiredTaskTypes, ["mitigate", "recover"]);
});

test("requiresItOperationsReview returns true for mitigate task type", () => {
  assert.equal(requiresItOperationsReview("mitigate"), true);
});

test("requiresItOperationsReview returns true for recover task type", () => {
  assert.equal(requiresItOperationsReview("recover"), true);
});

test("requiresItOperationsReview returns false for detect task type", () => {
  assert.equal(requiresItOperationsReview("detect"), false);
});
