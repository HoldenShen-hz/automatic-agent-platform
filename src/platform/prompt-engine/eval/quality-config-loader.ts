/**
 * Quality Configuration Loader
 *
 * Loads quality gate configuration from config/quality/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { QualityGateConfig } from "./types.js";

// Zod schema for quality gate configuration validation
const RiskLevelThresholdSchema = z.object({
  riskClass: z.enum(["low", "medium", "high", "critical"]),
  passThreshold: z.number().min(0).max(1),
  criticalThreshold: z.number().min(0).max(1),
  enforcement: z.enum(["blocking", "warning"]),
  // R16-18 FIX: delta-based threshold per model/tier
  deltaThreshold: z.number().min(-1).max(1).optional(),
});

const DomainThresholdOverrideSchema = z.object({
  domainId: z.string().min(1),
  riskLevelThresholds: z.array(RiskLevelThresholdSchema),
});

const QualityGateConfigSchema = z.object({
  qualityGate: z.object({
    defaultPassThreshold: z.number().min(0).max(1),
    criticalPassThreshold: z.number().min(0).max(1),
    enforcement: z.enum(["blocking", "warning"]),
    // R16-18 FIX: delta-based threshold
    deltaThreshold: z.number().min(-1).max(1).optional(),
  }),
  qualityScoreWeights: z.object({
    successSignal: z.number().min(0),
    completionOutcome: z.number().min(0),
    failureSignal: z.number().min(0),
    partialSignal: z.number().min(0),
  }),
  actionThresholds: z.object({
    completeMinScore: z.number().min(0).max(1),
    approvalRequiredScore: z.number().min(0).max(1),
    retryMaxFailures: z.number().int().nonnegative(),
  }),
  evidence: z.object({
    enabled: z.boolean(),
    artifactKind: z.string(),
    retentionDays: z.number().int().positive(),
  }),
  // Per-risk-level thresholds per §17.3 (optional with manual default handling)
  riskLevelThresholds: z.array(RiskLevelThresholdSchema).optional(),
  // Per-domain threshold overrides per §17.3 (optional with manual default handling)
  domainThresholdOverrides: z.array(DomainThresholdOverrideSchema).optional(),
});

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/quality/default.json");

export function loadQualityConfig(configPath: string = DEFAULT_CONFIG_PATH): QualityGateConfig {
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Validate parsed config against Zod schema
    const validated = QualityGateConfigSchema.parse(parsed);

    const DEFAULT_RISK_THRESHOLDS = [
      { riskClass: "low" as const, passThreshold: 0.4, criticalThreshold: 0.7, enforcement: "warning" as const },
      { riskClass: "medium" as const, passThreshold: 0.55, criticalThreshold: 0.8, enforcement: "blocking" as const },
      { riskClass: "high" as const, passThreshold: 0.7, criticalThreshold: 0.9, enforcement: "blocking" as const },
      { riskClass: "critical" as const, passThreshold: 0.85, criticalThreshold: 0.95, enforcement: "blocking" as const },
    ];

    return {
      qualityGate: {
        defaultPassThreshold: validated.qualityGate.defaultPassThreshold,
        criticalPassThreshold: validated.qualityGate.criticalPassThreshold,
        enforcement: validated.qualityGate.enforcement,
        ...(validated.qualityGate.deltaThreshold !== undefined && { deltaThreshold: validated.qualityGate.deltaThreshold }),
      },
      qualityScoreWeights: {
        successSignal: validated.qualityScoreWeights.successSignal,
        completionOutcome: validated.qualityScoreWeights.completionOutcome,
        failureSignal: validated.qualityScoreWeights.failureSignal,
        partialSignal: validated.qualityScoreWeights.partialSignal,
      },
      actionThresholds: {
        completeMinScore: validated.actionThresholds.completeMinScore,
        approvalRequiredScore: validated.actionThresholds.approvalRequiredScore,
        retryMaxFailures: validated.actionThresholds.retryMaxFailures,
      },
      evidence: {
        enabled: validated.evidence.enabled,
        artifactKind: validated.evidence.artifactKind,
        retentionDays: validated.evidence.retentionDays,
      },
      riskLevelThresholds: (validated.riskLevelThresholds == null ? DEFAULT_RISK_THRESHOLDS : validated.riskLevelThresholds) as QualityGateConfig["riskLevelThresholds"],
      domainThresholdOverrides: (validated.domainThresholdOverrides == null ? [] : validated.domainThresholdOverrides) as QualityGateConfig["domainThresholdOverrides"],
    };
  } catch (err) {
    // §168-1954 FIX: Bare catch was silently swallowing all errors including config file not found,
    // JSON parse errors, and Zod validation failures. Now we log the error to aid debugging.
    // Return default config only for truly non-critical cases.
    const errorCode = err instanceof Error ? err.message : String(err);
    // Only use default for file-not-found; re-throw configuration/parse errors
    if (err instanceof SyntaxError || (err instanceof Error && err.name === "ZodError")) {
      throw new Error(`quality_config.invalid:${configPath}:${errorCode}`);
    }
    // For truly unrecoverable errors, return defaults but log
    console.error(`[quality-config-loader] Failed to load ${configPath}: ${errorCode}`);
    return {
      qualityGate: {
        defaultPassThreshold: 0.8,
        criticalPassThreshold: 0.95,
        enforcement: "blocking" as const,
        deltaThreshold: 0.0, // R16-18 FIX: delta-based, pass if (score - baseline) >= 0
      },
      qualityScoreWeights: {
        successSignal: 0.4,
        completionOutcome: 0.3,
        failureSignal: 0.2,
        partialSignal: 0.1,
      },
      actionThresholds: {
        completeMinScore: 0.7,
        approvalRequiredScore: 0.5,
        retryMaxFailures: 3,
      },
      evidence: {
        enabled: true,
        artifactKind: "quality_report",
        retentionDays: 30,
      },
      riskLevelThresholds: [
        { riskClass: "low", passThreshold: 0.4, criticalThreshold: 0.7, enforcement: "warning" },
        { riskClass: "medium", passThreshold: 0.55, criticalThreshold: 0.8, enforcement: "blocking" },
        { riskClass: "high", passThreshold: 0.7, criticalThreshold: 0.9, enforcement: "blocking" },
        { riskClass: "critical", passThreshold: 0.85, criticalThreshold: 0.95, enforcement: "blocking" },
      ],
      domainThresholdOverrides: [],
    };
  }
}
