/**
 * Quality Configuration Loader
 *
 * Loads quality gate configuration from config/quality/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ValidationError } from "../../contracts/errors.js";
import type { QualityGateConfig } from "./types.js";

// Zod schema for quality gate configuration validation
const QualityGateConfigSchema = z.object({
  qualityGate: z.object({
    defaultPassThreshold: z.number().min(0).max(1),
    criticalPassThreshold: z.number().min(0).max(1),
    enforcement: z.enum(["blocking", "warning"]),
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
}).superRefine((value, ctx) => {
  const totalWeight =
    value.qualityScoreWeights.successSignal
    + value.qualityScoreWeights.completionOutcome
    + value.qualityScoreWeights.failureSignal
    + value.qualityScoreWeights.partialSignal;
  if (Math.abs(totalWeight - 1) > 0.0001) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["qualityScoreWeights"],
      message: "qualityScoreWeights must sum to 1.",
    });
  }
  if (value.actionThresholds.completeMinScore <= value.actionThresholds.approvalRequiredScore) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["actionThresholds", "completeMinScore"],
      message: "completeMinScore must be greater than approvalRequiredScore.",
    });
  }
});

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/quality/default.json");

const DEFAULT_QUALITY_CONFIG: QualityGateConfig = {
  qualityGate: {
    defaultPassThreshold: 0.8,
    criticalPassThreshold: 0.95,
    enforcement: "blocking",
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
};

function isMissingConfigError(error: unknown): boolean {
  return error != null
    && typeof error === "object"
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}

export function loadQualityConfig(configPath: string = DEFAULT_CONFIG_PATH): QualityGateConfig {
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    const validated = QualityGateConfigSchema.safeParse(parsed);
    if (!validated.success) {
      throw new ValidationError(
        "quality_config.invalid",
        "quality_config.invalid",
        {
          retryable: false,
          details: {
            configPath,
            issues: validated.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
      );
    }
    const resolved = validated.data;

    return {
      qualityGate: {
        defaultPassThreshold: resolved.qualityGate.defaultPassThreshold,
        criticalPassThreshold: resolved.qualityGate.criticalPassThreshold,
        enforcement: resolved.qualityGate.enforcement,
      },
      qualityScoreWeights: {
        successSignal: resolved.qualityScoreWeights.successSignal,
        completionOutcome: resolved.qualityScoreWeights.completionOutcome,
        failureSignal: resolved.qualityScoreWeights.failureSignal,
        partialSignal: resolved.qualityScoreWeights.partialSignal,
      },
      actionThresholds: {
        completeMinScore: resolved.actionThresholds.completeMinScore,
        approvalRequiredScore: resolved.actionThresholds.approvalRequiredScore,
        retryMaxFailures: resolved.actionThresholds.retryMaxFailures,
      },
      evidence: {
        enabled: resolved.evidence.enabled,
        artifactKind: resolved.evidence.artifactKind,
        retentionDays: resolved.evidence.retentionDays,
      },
    };
  } catch (err) {
    if (isMissingConfigError(err)) {
      return DEFAULT_QUALITY_CONFIG;
    }
    throw err;
  }
}
