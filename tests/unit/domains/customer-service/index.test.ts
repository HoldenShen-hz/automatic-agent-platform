import assert from "node:assert/strict";
import test from "node:test";

import {
  CustomerServiceTaskTypeSchema,
  CUSTOMER_SERVICE_DOMAIN_PRESET,
  CustomerServiceDomainPreset,
  requiresCustomerServiceReview,
} from "../../../../src/domains/customer-service/index.js";

test("CustomerServiceTaskTypeSchema accepts valid task types", () => {
  const types = ["triage", "respond", "escalate"] as const;
  for (const type of types) {
    const result = CustomerServiceTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("CustomerServiceTaskTypeSchema rejects invalid task types", () => {
  const result = CustomerServiceTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has correct structure", () => {
  assert.equal(CUSTOMER_SERVICE_DOMAIN_PRESET.domainId, "customer-service");
  assert.ok(Array.isArray(CUSTOMER_SERVICE_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(CUSTOMER_SERVICE_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(CUSTOMER_SERVICE_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(CUSTOMER_SERVICE_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(CUSTOMER_SERVICE_DOMAIN_PRESET.requiredCapabilities, ["triage", "respond", "escalate"]);
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(CUSTOMER_SERVICE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["respond", "escalate"]);
});

test("requiresCustomerServiceReview returns true for respond task type", () => {
  assert.equal(requiresCustomerServiceReview("respond"), true);
});

test("requiresCustomerServiceReview returns true for escalate task type", () => {
  assert.equal(requiresCustomerServiceReview("escalate"), true);
});

test("requiresCustomerServiceReview returns false for triage task type", () => {
  assert.equal(requiresCustomerServiceReview("triage"), false);
});
