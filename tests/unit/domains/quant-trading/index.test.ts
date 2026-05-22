import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_QUANT_TRADING_PRE_TRADE_LIMIT_POLICY,
  QuantTradingTaskTypeSchema,
  QUANT_TRADING_DOMAIN_PRESET,
  evaluateQuantTradingPreTradeRisk,
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

test("evaluateQuantTradingPreTradeRisk applies guards to simulate tasks", () => {
  const decision = evaluateQuantTradingPreTradeRisk({
    taskType: "simulate",
    symbol: "AAPL",
    side: "buy",
    orderQuantityUnits: 100,
    orderNotionalUsd: 150_000,
    currentPositionUnits: 950,
    realizedDailyLossUsd: 30_000,
    drawdownPercent: 15,
    limitPolicy: DEFAULT_QUANT_TRADING_PRE_TRADE_LIMIT_POLICY,
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("quant_trading.pre_trade_risk.order_notional_limit_exceeded"));
});

test("evaluateQuantTradingPreTradeRisk rejects negative notional and quantity", () => {
  const decision = evaluateQuantTradingPreTradeRisk({
    taskType: "trade",
    symbol: "AAPL",
    side: "buy",
    orderQuantityUnits: -1,
    orderNotionalUsd: -10,
    currentPositionUnits: 0,
    realizedDailyLossUsd: 0,
    drawdownPercent: 0,
    limitPolicy: DEFAULT_QUANT_TRADING_PRE_TRADE_LIMIT_POLICY,
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("quant_trading.pre_trade_risk.invalid_order_quantity"));
  assert.ok(decision.reasons.includes("quant_trading.pre_trade_risk.invalid_order_notional"));
});
