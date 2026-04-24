import assert from "node:assert/strict";
import test from "node:test";

import {
  AdvertisingTaskTypeSchema,
  ADVERTISING_DOMAIN_PRESET,
  requiresAdvertisingReview,
} from "../../../../src/domains/advertising/index.js";

test("AdvertisingTaskTypeSchema accepts valid task types", () => {
  const types = ["plan", "launch", "optimize"] as const;
  for (const type of types) {
    const result = AdvertisingTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("AdvertisingTaskTypeSchema rejects invalid task types", () => {
  const result = AdvertisingTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("ADVERTISING_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(ADVERTISING_DOMAIN_PRESET.domainId, "advertising");
});

test("ADVERTISING_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(ADVERTISING_DOMAIN_PRESET.displayName, "Advertising");
});

test("ADVERTISING_DOMAIN_PRESET has correct task types", () => {
  assert.deepEqual(ADVERTISING_DOMAIN_PRESET.requiredCapabilities, ["plan", "launch", "optimize"]);
});

test("ADVERTISING_DOMAIN_PRESET reviewRequiredTaskTypes includes launch and optimize", () => {
  assert.deepEqual(ADVERTISING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["launch", "optimize"]);
});

test("requiresAdvertisingReview returns true for launch task type", () => {
  assert.equal(requiresAdvertisingReview("launch"), true);
});

test("requiresAdvertisingReview returns true for optimize task type", () => {
  assert.equal(requiresAdvertisingReview("optimize"), true);
});

test("requiresAdvertisingReview returns false for plan task type", () => {
  assert.equal(requiresAdvertisingReview("plan"), false);
});
