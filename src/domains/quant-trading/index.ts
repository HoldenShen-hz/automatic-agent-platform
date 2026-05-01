import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const QuantTradingTaskTypeSchema = z.enum(["research", "simulate", "trade"]);
export type QuantTradingTaskType = z.infer<typeof QuantTradingTaskTypeSchema>;

/**
 * R16-04 FIX: Domain-specific risk guards for quant-trading operations.
 * These safety gates implement the loss-limit, position-size, and market-hours
 * constraints required by the financial operations safety门 (§198-2304).
 */
export const QUANT_TRADING_RISK_GUARDRAILS = Object.freeze({
  /** Maximum loss limit per trade session before requiring review */
  maxLossLimit: 10_000,
  /** Maximum position size as a fraction of portfolio (0-1) */
  maxPositionSizeFraction: 0.05,
  /** Trading hours constraint - only trade during market hours */
  marketHoursOnly: true,
  /** Require pre-trade risk validation */
  preTradeRiskValidation: true,
});

export interface QuantTradingRiskContext {
  currentLoss: number;
  proposedPositionSize: number;
  tradingHoursActive: boolean;
}

/**
 * Validates that a quant-trading operation passes all safety gates.
 * @returns true if the operation is safe to execute
 */
export function validateQuantTradingRisk(context: QuantTradingRiskContext): boolean {
  if (context.currentLoss > QUANT_TRADING_RISK_GUARDRAILS.maxLossLimit) {
    return false;
  }
  if (context.proposedPositionSize > QUANT_TRADING_RISK_GUARDRAILS.maxPositionSizeFraction) {
    return false;
  }
  if (QUANT_TRADING_RISK_GUARDRAILS.marketHoursOnly && !context.tradingHoursActive) {
    return false;
  }
  return true;
}

export const QUANT_TRADING_DOMAIN_PRESET = createDomainModulePreset("quant-trading", ["research", "simulate", "trade"] as const, ["simulate", "trade"] as const);
export type QuantTradingDomainPreset = typeof QUANT_TRADING_DOMAIN_PRESET;

export function requiresQuantTradingReview(taskType: QuantTradingTaskType): boolean {
  return requiresPresetReview(QUANT_TRADING_DOMAIN_PRESET, taskType);
}
