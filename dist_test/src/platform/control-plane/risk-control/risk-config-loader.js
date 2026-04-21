/**
 * Risk configuration loader
 * Loads risk matrix from config/risk/default.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/risk/default.json");
export function loadRiskConfig(configPath = DEFAULT_CONFIG_PATH) {
    const raw = readFileSync(configPath, "utf-8");
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
//# sourceMappingURL=risk-config-loader.js.map