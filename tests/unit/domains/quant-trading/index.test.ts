import assert from "node:assert/strict";
import test from "node:test";

import {
  QuantTradingTaskTypeSchema,
  QUANT_TRADING_DOMAIN_PRESET,
  requiresQuantTradingReview,
} from "../../../../src/domains/quant-trading/index.js";

test("QuantTradingTaskTypeSchema accepts valid task types", () => {
  const types = ["research", "simulate", "trade"] as const;
  for (const type of types) {
    const result = QuantTradingTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("QuantTradingTaskTypeSchema rejects invalid task types", () => {
  const result = QuantTradingTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("QUANT_TRADING_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(QUANT_TRADING_DOMAIN_PRESET.domainId, "quant-trading");
});

test("QUANT_TRADING_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(QUANT_TRADING_DOMAIN_PRESET.displayName, "Quant Trading");
});

test("QUANT_TRADING_DOMAIN_PRESET has correct task types", () => {
  assert.deepEqual(QUANT_TRADING_DOMAIN_PRESET.requiredCapabilities, ["research", "simulate", "trade"]);
});

test("QUANT_TRADING_DOMAIN_PRESET reviewRequiredTaskTypes includes simulate and trade", () => {
  assert.deepEqual(QUANT_TRADING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["simulate", "trade"]);
});

test("requiresQuantTradingReview returns true for simulate task type", () => {
  assert.equal(requiresQuantTradingReview("simulate"), true);
});

test("requiresQuantTradingReview returns true for trade task type", () => {
  assert.equal(requiresQuantTradingReview("trade"), true);
});

test("requiresQuantTradingReview returns false for research task type", () => {
  assert.equal(requiresQuantTradingReview("research"), false);
});
