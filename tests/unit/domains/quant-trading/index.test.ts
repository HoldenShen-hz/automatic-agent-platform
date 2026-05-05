import assert from "node:assert/strict";
import test from "node:test";

import {
  QuantTradingTaskTypeSchema,
  QUANT_TRADING_DOMAIN_PRESET,
  QUANT_TRADING_RISK_GUARDRAILS,
  requiresQuantTradingReview,
  validateQuantTradingRisk,
  type QuantTradingRiskContext,
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
  assert.deepEqual(QUANT_TRADING_DOMAIN_PRESET.reviewRequiredTaskTypes, ["simulate", "trade"]);
});

test("QUANT_TRADING_DOMAIN_PRESET has defaultWorkflowIds", () => {
  assert.ok(Array.isArray(QUANT_TRADING_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(QUANT_TRADING_DOMAIN_PRESET.defaultWorkflowIds.length > 0);
});

test("QUANT_TRADING_DOMAIN_PRESET has defaultToolBundleIds", () => {
  assert.ok(Array.isArray(QUANT_TRADING_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(QUANT_TRADING_DOMAIN_PRESET.defaultToolBundleIds.length > 0);
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

test("QUANT_TRADING_DOMAIN_PRESET is frozen and immutable", () => {
  assert.ok(Object.isFrozen(QUANT_TRADING_DOMAIN_PRESET));
  assert.ok(Object.isFrozen(QUANT_TRADING_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Object.isFrozen(QUANT_TRADING_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("QUANT_TRADING_RISK_GUARDRAILS encodes loss, position, and market-hour gates", () => {
  assert.equal(QUANT_TRADING_RISK_GUARDRAILS.maxLossLimit, 10_000);
  assert.equal(QUANT_TRADING_RISK_GUARDRAILS.maxPositionSizeFraction, 0.05);
  assert.equal(QUANT_TRADING_RISK_GUARDRAILS.marketHoursOnly, true);
  assert.equal(QUANT_TRADING_RISK_GUARDRAILS.preTradeRiskValidation, true);
});

test("validateQuantTradingRisk returns true for an in-bounds trade context", () => {
  const context: QuantTradingRiskContext = {
    currentLoss: 1_000,
    proposedPositionSize: 0.02,
    tradingHoursActive: true,
  };
  assert.equal(validateQuantTradingRisk(context), true);
});

test("validateQuantTradingRisk rejects contexts above the loss limit", () => {
  const context: QuantTradingRiskContext = {
    currentLoss: 10_001,
    proposedPositionSize: 0.02,
    tradingHoursActive: true,
  };
  assert.equal(validateQuantTradingRisk(context), false);
});

test("validateQuantTradingRisk rejects contexts above the position-size limit", () => {
  const context: QuantTradingRiskContext = {
    currentLoss: 500,
    proposedPositionSize: 0.051,
    tradingHoursActive: true,
  };
  assert.equal(validateQuantTradingRisk(context), false);
});

test("validateQuantTradingRisk rejects off-hours trading when market-hours gate is enabled", () => {
  const context: QuantTradingRiskContext = {
    currentLoss: 500,
    proposedPositionSize: 0.02,
    tradingHoursActive: false,
  };
  assert.equal(validateQuantTradingRisk(context), false);
});
