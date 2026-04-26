import assert from "node:assert/strict";
import test from "node:test";

import {
  CustomerServiceTaskTypeSchema,
  CUSTOMER_SERVICE_DOMAIN_PRESET,
  requiresCustomerServiceReview,
  type CustomerServiceTaskType,
} from "../../../../src/domains/customer-service/index.js";

test("CustomerServiceTaskTypeSchema accepts valid task types", () => {
  assert.equal(CustomerServiceTaskTypeSchema.parse("triage"), "triage");
  assert.equal(CustomerServiceTaskTypeSchema.parse("respond"), "respond");
  assert.equal(CustomerServiceTaskTypeSchema.parse("escalate"), "escalate");
});

test("CustomerServiceTaskTypeSchema rejects invalid task types", () => {
  assert.throws(() => CustomerServiceTaskTypeSchema.parse("invalid"));
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(CUSTOMER_SERVICE_DOMAIN_PRESET.domainId, "customer-service");
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(CUSTOMER_SERVICE_DOMAIN_PRESET.displayName, "Customer Service");
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has requiredCapabilities", () => {
  assert.deepEqual(CUSTOMER_SERVICE_DOMAIN_PRESET.requiredCapabilities, ["triage", "respond", "escalate"]);
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has reviewRequiredTaskTypes", () => {
  assert.deepEqual(CUSTOMER_SERVICE_DOMAIN_PRESET.reviewRequiredTaskTypes, ["respond", "escalate"]);
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has defaultWorkflowIds", () => {
  assert.ok(Array.isArray(CUSTOMER_SERVICE_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(CUSTOMER_SERVICE_DOMAIN_PRESET.defaultWorkflowIds.length > 0);
});

test("CUSTOMER_SERVICE_DOMAIN_PRESET has defaultToolBundleIds", () => {
  assert.ok(Array.isArray(CUSTOMER_SERVICE_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(CUSTOMER_SERVICE_DOMAIN_PRESET.defaultToolBundleIds.length > 0);
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

test("CUSTOMER_SERVICE_DOMAIN_PRESET is frozen and immutable", () => {
  assert.ok(Object.isFrozen(CUSTOMER_SERVICE_DOMAIN_PRESET));
  assert.ok(Object.isFrozen(CUSTOMER_SERVICE_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Object.isFrozen(CUSTOMER_SERVICE_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
