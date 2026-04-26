import assert from "node:assert/strict";
import test from "node:test";

import {
  QuantTradingTaskTypeSchema,
  QUANT_TRADING_DOMAIN_PRESET,
  requiresQuantTradingReview,
  type QuantTradingTaskType,
} from "../../../../src/domains/quant-trading/index.js";

test("QuantTradingTaskTypeSchema accepts valid task types", () => {
  assert.equal(QuantTradingTaskTypeSchema.parse("research"), "research");
  assert.equal(QuantTradingTaskTypeSchema.parse("simulate"), "simulate");
  assert.equal(QuantTradingTaskTypeSchema.parse("trade"), "trade");
});

test("QuantTradingTaskTypeSchema rejects invalid task types", () => {
  assert.throws(() => QuantTradingTaskTypeSchema.parse("invalid"));
});

test("QUANT_TRADING_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(QUANT_TRADING_DOMAIN_PRESET.domainId, "quant-trading");
});

test("QUANT_TRADING_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(QUANT_TRADING_DOMAIN_PRESET.displayName, "Quant Trading");
});

test("QUANT_TRADING_DOMAIN_PRESET has requiredCapabilities", () => {
  assert.deepEqual(QUANT_TRADING_DOMAIN_PRESET.requiredCapabilities, ["research", "simulate", "trade"]);
});

test("QUANT_TRADING_DOMAIN_PRESET has reviewRequiredTaskTypes", () => {
  assert.deepEqual(QUANT_TRADING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["trade"]);
});

test("QUANT_TRADING_DOMAIN_PRESET has defaultWorkflowIds", () => {
  assert.ok(Array.isArray(QUANT_TRADING_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(QUANT_TRADING_DOMAIN_PRESET.defaultWorkflowIds.length > 0);
});

test("QUANT_TRADING_DOMAIN_PRESET has defaultToolBundleIds", () => {
  assert.ok(Array.isArray(QUANT_TRADING_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(QUANT_TRADING_DOMAIN_PRESET.defaultToolBundleIds.length > 0);
});

test("requiresQuantTradingReview returns true for trade task type", () => {
  assert.equal(requiresQuantTradingReview("trade"), true);
});

test("requiresQuantTradingReview returns false for research task type", () => {
  assert.equal(requiresQuantTradingReview("research"), false);
});

test("requiresQuantTradingReview returns false for simulate task type", () => {
  assert.equal(requiresQuantTradingReview("simulate"), false);
});

test("QUANT_TRADING_DOMAIN_PRESET is frozen and immutable", () => {
  assert.ok(Object.isFrozen(QUANT_TRADING_DOMAIN_PRESET));
  assert.ok(Object.isFrozen(QUANT_TRADING_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Object.isFrozen(QUANT_TRADING_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
