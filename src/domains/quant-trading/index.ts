import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const QuantTradingTaskTypeSchema = z.enum(["research", "simulate", "trade"]);
export type QuantTradingTaskType = z.infer<typeof QuantTradingTaskTypeSchema>;

export interface QuantTradingPreTradeRiskLimitPolicy {
  readonly maxPositionUnits: number;
  readonly maxOrderNotionalUsd: number;
  readonly maxDailyLossUsd: number;
  readonly maxDrawdownPercent: number;
}

export interface QuantTradingPreTradeRiskInput {
  readonly taskType: QuantTradingTaskType;
  readonly symbol: string;
  readonly side: "buy" | "sell";
  readonly orderQuantityUnits: number;
  readonly orderNotionalUsd: number;
  readonly currentPositionUnits: number;
  readonly projectedPositionUnits?: number | null;
  readonly realizedDailyLossUsd: number;
  readonly projectedDailyLossUsd?: number | null;
  readonly drawdownPercent: number;
  readonly limitPolicy: QuantTradingPreTradeRiskLimitPolicy;
}

export interface QuantTradingPreTradeRiskDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly evaluatedGuards: readonly ("order_notional" | "position_limit" | "daily_loss_limit" | "drawdown_limit")[];
}

export const QUANT_TRADING_DOMAIN_PRESET = createDomainModulePreset("quant-trading", ["research", "simulate", "trade"] as const, ["simulate", "trade"] as const);
export type QuantTradingDomainPreset = typeof QUANT_TRADING_DOMAIN_PRESET;

export const DEFAULT_QUANT_TRADING_PRE_TRADE_LIMIT_POLICY: QuantTradingPreTradeRiskLimitPolicy = {
  maxPositionUnits: 1_000,
  maxOrderNotionalUsd: 100_000,
  maxDailyLossUsd: 25_000,
  maxDrawdownPercent: 12,
};

export function requiresQuantTradingReview(taskType: QuantTradingTaskType): boolean {
  return requiresPresetReview(QUANT_TRADING_DOMAIN_PRESET, taskType);
}

export function evaluateQuantTradingPreTradeRisk(
  input: QuantTradingPreTradeRiskInput,
): QuantTradingPreTradeRiskDecision {
  if (input.taskType !== "trade") {
    return {
      allowed: true,
      reasons: [],
      evaluatedGuards: [],
    };
  }

  const evaluatedGuards: QuantTradingPreTradeRiskDecision["evaluatedGuards"] = [
    "order_notional",
    "position_limit",
    "daily_loss_limit",
    "drawdown_limit",
  ];
  const reasons: string[] = [];
  const projectedPositionUnits = input.projectedPositionUnits ?? (
    input.side === "buy"
      ? input.currentPositionUnits + input.orderQuantityUnits
      : input.currentPositionUnits - input.orderQuantityUnits
  );
  const projectedDailyLossUsd = input.projectedDailyLossUsd ?? input.realizedDailyLossUsd;

  if (input.orderNotionalUsd > input.limitPolicy.maxOrderNotionalUsd) {
    reasons.push("quant_trading.pre_trade_risk.order_notional_limit_exceeded");
  }
  if (Math.abs(projectedPositionUnits) > input.limitPolicy.maxPositionUnits) {
    reasons.push("quant_trading.pre_trade_risk.position_limit_exceeded");
  }
  if (projectedDailyLossUsd > input.limitPolicy.maxDailyLossUsd) {
    reasons.push("quant_trading.pre_trade_risk.daily_loss_limit_exceeded");
  }
  if (input.drawdownPercent > input.limitPolicy.maxDrawdownPercent) {
    reasons.push("quant_trading.pre_trade_risk.drawdown_limit_exceeded");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    evaluatedGuards,
  };
}
