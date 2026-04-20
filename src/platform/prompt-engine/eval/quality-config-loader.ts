/**
 * Quality Configuration Loader
 *
 * Loads quality gate configuration from config/quality/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { QualityGateConfig } from "./types.js";

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/quality/default.json");

export function loadQualityConfig(configPath: string = DEFAULT_CONFIG_PATH): QualityGateConfig {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw);

  return {
    qualityGate: {
      defaultPassThreshold: parsed.qualityGate.defaultPassThreshold,
      criticalPassThreshold: parsed.qualityGate.criticalPassThreshold,
      enforcement: parsed.qualityGate.enforcement,
    },
    qualityScoreWeights: {
      successSignal: parsed.qualityScoreWeights.successSignal,
      completionOutcome: parsed.qualityScoreWeights.completionOutcome,
      failureSignal: parsed.qualityScoreWeights.failureSignal,
      partialSignal: parsed.qualityScoreWeights.partialSignal,
    },
    actionThresholds: {
      completeMinScore: parsed.actionThresholds.completeMinScore,
      approvalRequiredScore: parsed.actionThresholds.approvalRequiredScore,
      retryMaxFailures: parsed.actionThresholds.retryMaxFailures,
    },
    evidence: {
      enabled: parsed.evidence.enabled,
      artifactKind: parsed.evidence.artifactKind,
      retentionDays: parsed.evidence.retentionDays,
    },
  };
}
