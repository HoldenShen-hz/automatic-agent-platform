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
    stepTypeRisk: z.number(),
    targetSystemRisk: z.number(),
    dataClassRisk: z.number(),
    blastRadius: z.number(),
    priorFailureRate: z.number(),
    confidence: z.number(),
    reversibility: z.number().optional(),
    temporalContext: z.number().optional(),
  }),
  stepTypeRiskValues: z.record(z.string(), z.number()),
  targetSystemRiskValues: z.record(z.string(), z.number()),
  dataClassRiskValues: z.record(z.string(), z.number()),
  blastRadiusValues: z.record(z.string(), z.number()),
  priorFailureRateThresholds: z.object({
    low: z.object({ maxPercent: z.number(), value: z.number() }),
    medium: z.object({ maxPercent: z.number(), value: z.number() }),
    high: z.object({ maxPercent: z.number(), value: z.number() }),
    critical: z.object({ maxPercent: z.number(), value: z.number() }),
  }),
  confidenceValues: z.record(z.string(), z.number()),
  reversibilityValues: z.record(z.string(), z.number()).optional(),
  temporalContextValues: z.record(z.string(), z.number()).optional(),
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
      stepTypeRisk: fw.stepTypeRisk,
      targetSystemRisk: fw.targetSystemRisk,
      dataClassRisk: fw.dataClassRisk,
      blastRadius: fw.blastRadius,
      priorFailureRate: fw.priorFailureRate,
      confidence: fw.confidence,
      ...(fw.reversibility !== undefined && { reversibility: fw.reversibility }),
      ...(fw.temporalContext !== undefined && { temporalContext: fw.temporalContext }),
    };
  }

  return {
    factorWeights: normalizeFactorWeights(validated.factorWeights),
    stepTypeRiskValues: validated.stepTypeRiskValues as RiskConfig["stepTypeRiskValues"],
    targetSystemRiskValues: validated.targetSystemRiskValues as RiskConfig["targetSystemRiskValues"],
    dataClassRiskValues: validated.dataClassRiskValues as RiskConfig["dataClassRiskValues"],
    blastRadiusValues: validated.blastRadiusValues as RiskConfig["blastRadiusValues"],
    priorFailureRateThresholds: {
      low: { maxPercent: validated.priorFailureRateThresholds.low.maxPercent, value: validated.priorFailureRateThresholds.low.value },
      medium: { maxPercent: validated.priorFailureRateThresholds.medium.maxPercent, value: validated.priorFailureRateThresholds.medium.value },
      high: { maxPercent: validated.priorFailureRateThresholds.high.maxPercent, value: validated.priorFailureRateThresholds.high.value },
      critical: { maxPercent: validated.priorFailureRateThresholds.critical.maxPercent, value: validated.priorFailureRateThresholds.critical.value },
    },
    confidenceValues: validated.confidenceValues as RiskConfig["confidenceValues"],
    ...(validated.reversibilityValues !== undefined && { reversibilityValues: validated.reversibilityValues }),
    ...(validated.temporalContextValues !== undefined && { temporalContextValues: validated.temporalContextValues }),
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
