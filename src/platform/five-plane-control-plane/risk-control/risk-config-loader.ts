/**
 * Risk configuration loader
 * Loads risk matrix from config/risk/default.json
 */

import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PolicyDeniedError } from "../../contracts/errors.js";
import { checkSandboxPath, createConfigReadPolicy, type SandboxPolicy } from "../iam/sandbox-policy.js";
import type { RiskConfig } from "./types.js";

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/risk/default.json");

/**
 * JSON Schema for risk configuration validation.
 * R16-36 FIX #2122: JSON.parse without schema validation allows malformed data
 * to be accepted, causing downstream failures. This schema ensures the config
 * conforms to the expected structure before parsing.
 */
const RiskConfigSchema = z.object({
  factorWeights: z.object({
    operationRisk: z.number(),
    targetResourceCriticality: z.number(),
    dataSensitivity: z.number(),
    autonomyModeRisk: z.number(),
    tenantImpact: z.number(),
    blastRadius: z.number(),
    historicalFailureRate: z.number(),
    evidenceConfidence: z.number(),
  }),
  operationRiskValues: z.record(z.string(), z.number()),
  targetResourceCriticalityValues: z.record(z.string(), z.number()),
  dataSensitivityValues: z.record(z.string(), z.number()),
  autonomyModeRiskValues: z.record(z.string(), z.number()),
  tenantImpactValues: z.record(z.string(), z.number()),
  blastRadiusValues: z.record(z.string(), z.number()),
  historicalFailureRateThresholds: z.object({
    low: z.object({ maxPercent: z.number(), value: z.number() }),
    medium: z.object({ maxPercent: z.number(), value: z.number() }),
    high: z.object({ maxPercent: z.number(), value: z.number() }),
    critical: z.object({ maxPercent: z.number(), value: z.number() }),
  }),
  evidenceConfidenceValues: z.record(z.string(), z.number()),
  riskLevelThresholds: z.object({
    low: z.number(),
    medium: z.number(),
    high: z.number(),
    critical: z.number(),
  }),
  riskLevelActions: z.object({
    low: z.object({
      autoExecute: z.boolean(),
      logLevel: z.enum(["info", "warn", "error", "critical"]),
      requiresApproval: z.boolean(),
      approvalType: z.enum(["standard", "break_glass"]).optional(),
      sideEffect: z.enum(["normal", "normal_with_validation", "restricted", "prohibited"]),
      evidenceLevel: z.enum(["basic", "enhanced", "full", "legal"]),
    }),
    medium: z.object({
      autoExecute: z.boolean(),
      logLevel: z.enum(["info", "warn", "error", "critical"]),
      requiresApproval: z.boolean(),
      approvalType: z.enum(["standard", "break_glass"]).optional(),
      sideEffect: z.enum(["normal", "normal_with_validation", "restricted", "prohibited"]),
      evidenceLevel: z.enum(["basic", "enhanced", "full", "legal"]),
    }),
    high: z.object({
      autoExecute: z.boolean(),
      logLevel: z.enum(["info", "warn", "error", "critical"]),
      requiresApproval: z.boolean(),
      approvalType: z.enum(["standard", "break_glass"]).optional(),
      sideEffect: z.enum(["normal", "normal_with_validation", "restricted", "prohibited"]),
      evidenceLevel: z.enum(["basic", "enhanced", "full", "legal"]),
    }),
    critical: z.object({
      autoExecute: z.boolean(),
      logLevel: z.enum(["info", "warn", "error", "critical"]),
      requiresApproval: z.boolean(),
      approvalType: z.enum(["standard", "break_glass"]).optional(),
      sideEffect: z.enum(["normal", "normal_with_validation", "restricted", "prohibited"]),
      evidenceLevel: z.enum(["basic", "enhanced", "full", "legal"]),
    }),
  }),
});

/**
 * Loads the risk configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/risk/default.json)
 * @param sandboxPolicy - Optional sandbox policy for path validation
 * @returns The parsed risk configuration
 */
export function loadRiskConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
  sandboxPolicy?: SandboxPolicy,
): RiskConfig {
  // Validate path before reading to prevent path traversal attacks
  let effectivePath = configPath;
  if (sandboxPolicy != null) {
    const check = checkSandboxPath(sandboxPolicy, configPath);
    if (!check.allowed) {
      throw new PolicyDeniedError(
        check.reasonCode ?? "config.risk_denied",
        check.reasonCode ?? "config.risk_denied",
      );
    }
    effectivePath = check.normalizedPath;
  }

  const raw = readFileSync(effectivePath, "utf-8");
  // R16-36 FIX #2122: Validate JSON against schema before returning.
  // JSON.parse without schema validation allows malformed data to be accepted,
  // causing downstream failures when expected fields are missing or have wrong types.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("risk_config.parse_failed: Invalid JSON in risk configuration");
  }
  const validated = RiskConfigSchema.parse(parsed);

  function normalizeRiskLevelAction(
    action: z.infer<typeof RiskConfigSchema.shape.riskLevelActions.shape.low>,
  ): RiskConfig["riskLevelActions"]["low"] {
    return {
      autoExecute: action.autoExecute,
      logLevel: action.logLevel,
      requiresApproval: action.requiresApproval,
      ...(action.approvalType !== undefined && { approvalType: action.approvalType }),
      sideEffect: action.sideEffect,
      evidenceLevel: action.evidenceLevel,
    };
  }

  function normalizeFactorWeights(fw: z.infer<typeof RiskConfigSchema.shape.factorWeights>): RiskConfig["factorWeights"] {
    return {
      operationRisk: fw.operationRisk,
      targetResourceCriticality: fw.targetResourceCriticality,
      dataSensitivity: fw.dataSensitivity,
      autonomyModeRisk: fw.autonomyModeRisk,
      tenantImpact: fw.tenantImpact,
      blastRadius: fw.blastRadius,
      historicalFailureRate: fw.historicalFailureRate,
      evidenceConfidence: fw.evidenceConfidence,
    };
  }

  return {
    factorWeights: normalizeFactorWeights(validated.factorWeights),
    operationRiskValues: validated.operationRiskValues as RiskConfig["operationRiskValues"],
    targetResourceCriticalityValues: validated.targetResourceCriticalityValues as RiskConfig["targetResourceCriticalityValues"],
    dataSensitivityValues: validated.dataSensitivityValues as RiskConfig["dataSensitivityValues"],
    autonomyModeRiskValues: validated.autonomyModeRiskValues as RiskConfig["autonomyModeRiskValues"],
    tenantImpactValues: validated.tenantImpactValues as RiskConfig["tenantImpactValues"],
    blastRadiusValues: validated.blastRadiusValues as RiskConfig["blastRadiusValues"],
    historicalFailureRateThresholds: {
      low: { maxPercent: validated.historicalFailureRateThresholds.low.maxPercent, value: validated.historicalFailureRateThresholds.low.value },
      medium: { maxPercent: validated.historicalFailureRateThresholds.medium.maxPercent, value: validated.historicalFailureRateThresholds.medium.value },
      high: { maxPercent: validated.historicalFailureRateThresholds.high.maxPercent, value: validated.historicalFailureRateThresholds.high.value },
      critical: { maxPercent: validated.historicalFailureRateThresholds.critical.maxPercent, value: validated.historicalFailureRateThresholds.critical.value },
    },
    evidenceConfidenceValues: validated.evidenceConfidenceValues as RiskConfig["evidenceConfidenceValues"],
    riskLevelThresholds: {
      low: validated.riskLevelThresholds.low,
      medium: validated.riskLevelThresholds.medium,
      high: validated.riskLevelThresholds.high,
      critical: validated.riskLevelThresholds.critical,
    },
    riskLevelActions: {
      low: normalizeRiskLevelAction(validated.riskLevelActions.low),
      medium: normalizeRiskLevelAction(validated.riskLevelActions.medium),
      high: normalizeRiskLevelAction(validated.riskLevelActions.high),
      critical: normalizeRiskLevelAction(validated.riskLevelActions.critical),
    },
  };
}
