import assert from "node:assert/strict";
import test from "node:test";

import {
  FinancialServicesTaskTypeSchema,
  FINANCIAL_SERVICES_DOMAIN_PRESET,
  requiresFinancialServicesReview,
} from "../../../../src/domains/financial-services/index.js";

test("FinancialServicesTaskTypeSchema accepts valid task types", () => {
  const types = ["review", "advise", "execute"] as const;
  for (const type of types) {
    const result = FinancialServicesTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("FinancialServicesTaskTypeSchema rejects invalid task types", () => {
  const result = FinancialServicesTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("FINANCIAL_SERVICES_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(FINANCIAL_SERVICES_DOMAIN_PRESET.domainId, "financial-services");
});

test("FINANCIAL_SERVICES_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(FINANCIAL_SERVICES_DOMAIN_PRESET.displayName, "Financial Services");
});

test("FINANCIAL_SERVICES_DOMAIN_PRESET has correct task types", () => {
  assert.deepEqual(FINANCIAL_SERVICES_DOMAIN_PRESET.requiredCapabilities, ["review", "advise", "execute"]);
});

test("FINANCIAL_SERVICES_DOMAIN_PRESET reviewRequiredTaskTypes includes advise and execute", () => {
  assert.deepEqual(FINANCIAL_SERVICES_DOMAIN_PRESET.reviewRequiredTaskTypes, ["advise", "execute"]);
});

test("requiresFinancialServicesReview returns true for advise task type", () => {
  assert.equal(requiresFinancialServicesReview("advise"), true);
});

test("requiresFinancialServicesReview returns true for execute task type", () => {
  assert.equal(requiresFinancialServicesReview("execute"), true);
});

test("requiresFinancialServicesReview returns false for review task type", () => {
  assert.equal(requiresFinancialServicesReview("review"), false);
});
