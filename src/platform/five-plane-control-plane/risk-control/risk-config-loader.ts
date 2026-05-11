/**
 * Risk configuration loader
 * Loads risk matrix from config/risk/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PolicyDeniedError } from "../../contracts/errors.js";
import { checkSandboxPath, type SandboxPolicy } from "../iam/sandbox-policy.js";
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
      // ADR-026 v4.3: 8-factor canonical weights
      impact: parsed.factorWeights.impact,
      irreversibility: parsed.factorWeights.irreversibility,
      dataSensitivity: parsed.factorWeights.dataSensitivity,
      autonomyModeRisk: parsed.factorWeights.autonomyModeRisk,
      tenantImpact: parsed.factorWeights.tenantImpact,
      blastRadius: parsed.factorWeights.blastRadius,
      historicalFailureRate: parsed.factorWeights.historicalFailureRate,
      evidenceConfidence: parsed.factorWeights.evidenceConfidence,
    },
    impactValues: parsed.impactValues,
    irreversibilityValues: parsed.irreversibilityValues,
    dataSensitivityValues: parsed.dataSensitivityValues,
    autonomyModeRiskValues: parsed.autonomyModeRiskValues,
    tenantImpactValues: parsed.tenantImpactValues,
    blastRadiusValues: parsed.blastRadiusValues,
    historicalFailureRateThresholds: {
      low: { maxPercent: parsed.historicalFailureRateThresholds.low.maxPercent, value: parsed.historicalFailureRateThresholds.low.value },
      medium: { maxPercent: parsed.historicalFailureRateThresholds.medium.maxPercent, value: parsed.historicalFailureRateThresholds.medium.value },
      high: { maxPercent: parsed.historicalFailureRateThresholds.high.maxPercent, value: parsed.historicalFailureRateThresholds.high.value },
      critical: { maxPercent: parsed.historicalFailureRateThresholds.critical.maxPercent, value: parsed.historicalFailureRateThresholds.critical.value },
    },
    evidenceConfidenceValues: parsed.evidenceConfidenceValues,
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
