/**
 * Risk configuration loader
 * Loads risk matrix from config/risk/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { PolicyDeniedError, ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath, type SandboxPolicy } from "../iam/sandbox-policy.js";
import type { RiskConfig } from "./types.js";

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/risk/default.json");

const RiskLevelActionSchema = z.object({
  autoExecute: z.boolean(),
  logLevel: z.enum(["info", "warn", "error", "critical"]),
  requiresApproval: z.boolean(),
  approvalType: z.enum(["standard", "break_glass"]).optional(),
  sideEffect: z.enum(["normal", "normal_with_validation", "restricted", "prohibited"]),
  evidenceLevel: z.enum(["basic", "enhanced", "full", "legal"]),
});

const LegacyRiskConfigSchema = z.object({
  factorWeights: z.object({
    stepTypeRisk: z.number(),
    targetSystemRisk: z.number(),
    dataClassRisk: z.number(),
    blastRadius: z.number(),
    priorFailureRate: z.number(),
    confidence: z.number(),
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
  riskLevelThresholds: z.object({
    low: z.number(),
    medium: z.number(),
    high: z.number(),
    critical: z.number(),
  }),
  riskLevelActions: z.object({
    low: RiskLevelActionSchema,
    medium: RiskLevelActionSchema,
    high: RiskLevelActionSchema,
    critical: RiskLevelActionSchema,
  }),
});

const CanonicalRiskConfigSchema = z.object({
  factorWeights: z.object({
    impact: z.number(),
    irreversibility: z.number(),
    dataSensitivity: z.number(),
    autonomyModeRisk: z.number(),
    tenantImpact: z.number(),
    blastRadius: z.number(),
    historicalFailureRate: z.number(),
    evidenceConfidence: z.number(),
  }),
  impactValues: z.record(z.string(), z.number()),
  irreversibilityValues: z.record(z.string(), z.number()),
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
    low: RiskLevelActionSchema,
    medium: RiskLevelActionSchema,
    high: RiskLevelActionSchema,
    critical: RiskLevelActionSchema,
  }),
});

const RiskConfigSchema = z.union([CanonicalRiskConfigSchema, LegacyRiskConfigSchema]);

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw error;
  }

  const validated = RiskConfigSchema.safeParse(parsed);
  if (!validated.success) {
    throw new ValidationError(
      "risk_config.invalid_schema",
      `Invalid risk config schema at ${effectivePath}`,
      {
        details: {
          path: effectivePath,
          issues: validated.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
    );
  }

  return validated.data as RiskConfig;
}
