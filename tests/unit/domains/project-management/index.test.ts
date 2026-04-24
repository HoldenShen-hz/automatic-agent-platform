import assert from "node:assert/strict";
import test from "node:test";

import {
  ProjectManagementTaskTypeSchema,
  PROJECT_MANAGEMENT_DOMAIN_PRESET,
  ProjectManagementDomainPreset,
  requiresProjectManagementReview,
} from "../../../../src/domains/project-management/index.js";

test("ProjectManagementTaskTypeSchema accepts valid task types", () => {
  const types = ["plan", "coordinate", "report"] as const;
  for (const type of types) {
    const result = ProjectManagementTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("ProjectManagementTaskTypeSchema rejects invalid task types", () => {
  const result = ProjectManagementTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("PROJECT_MANAGEMENT_DOMAIN_PRESET has correct structure", () => {
  assert.equal(PROJECT_MANAGEMENT_DOMAIN_PRESET.domainId, "project-management");
  assert.ok(Array.isArray(PROJECT_MANAGEMENT_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(PROJECT_MANAGEMENT_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(PROJECT_MANAGEMENT_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(PROJECT_MANAGEMENT_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("PROJECT_MANAGEMENT_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(PROJECT_MANAGEMENT_DOMAIN_PRESET.requiredCapabilities, ["plan", "coordinate", "report"]);
});

test("PROJECT_MANAGEMENT_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(PROJECT_MANAGEMENT_DOMAIN_PRESET.reviewRequiredTaskTypes, ["coordinate", "report"]);
});

test("requiresProjectManagementReview returns true for coordinate task type", () => {
  assert.equal(requiresProjectManagementReview("coordinate"), true);
});

test("requiresProjectManagementReview returns true for report task type", () => {
  assert.equal(requiresProjectManagementReview("report"), true);
});

test("requiresProjectManagementReview returns false for plan task type", () => {
  assert.equal(requiresProjectManagementReview("plan"), false);
});
