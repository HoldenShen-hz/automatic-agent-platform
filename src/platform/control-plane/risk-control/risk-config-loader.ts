/**
 * Risk configuration loader
 * Loads risk matrix from config/risk/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PolicyDeniedError } from "../../contracts/errors.js";
import { checkSandboxPath, createConfigReadPolicy, type SandboxPolicy } from "../iam/sandbox-policy.js";
import type { RiskConfig } from "./types.js";

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/risk/default.json");

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
  const parsed = JSON.parse(raw);

  return {
    factorWeights: {
      stepTypeRisk: parsed.factorWeights.stepTypeRisk,
      targetSystemRisk: parsed.factorWeights.targetSystemRisk,
      dataClassRisk: parsed.factorWeights.dataClassRisk,
      blastRadius: parsed.factorWeights.blastRadius,
      priorFailureRate: parsed.factorWeights.priorFailureRate,
      confidence: parsed.factorWeights.confidence,
    },
    stepTypeRiskValues: parsed.stepTypeRiskValues,
    targetSystemRiskValues: parsed.targetSystemRiskValues,
    dataClassRiskValues: parsed.dataClassRiskValues,
    blastRadiusValues: parsed.blastRadiusValues,
    priorFailureRateThresholds: {
      low: { maxPercent: parsed.priorFailureRateThresholds.low.maxPercent, value: parsed.priorFailureRateThresholds.low.value },
      medium: { maxPercent: parsed.priorFailureRateThresholds.medium.maxPercent, value: parsed.priorFailureRateThresholds.medium.value },
      high: { maxPercent: parsed.priorFailureRateThresholds.high.maxPercent, value: parsed.priorFailureRateThresholds.high.value },
      critical: { maxPercent: parsed.priorFailureRateThresholds.critical.maxPercent, value: parsed.priorFailureRateThresholds.critical.value },
    },
    confidenceValues: parsed.confidenceValues,
    riskLevelThresholds: {
      low: parsed.riskLevelThresholds.low,
      medium: parsed.riskLevelThresholds.medium,
      high: parsed.riskLevelThresholds.high,
      critical: parsed.riskLevelThresholds.critical,
    },
    riskLevelActions: {
      low: parsed.riskLevelActions.low,
      medium: parsed.riskLevelActions.medium,
      high: parsed.riskLevelActions.high,
      critical: parsed.riskLevelActions.critical,
    },
  };
}
