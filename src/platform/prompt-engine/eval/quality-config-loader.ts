/**
 * Quality Configuration Loader
 *
 * Loads quality gate configuration from config/quality/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { PolicyDeniedError } from "../../../contracts/errors.js";
import { checkSandboxPath, createConfigReadPolicy, type SandboxPolicy } from "../../../control-plane/iam/sandbox-policy.js";
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
});

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/quality/default.json");

/**
 * Loads the quality gate configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/quality/default.json)
 * @param sandboxPolicy - Optional sandbox policy for path validation
 * @returns The parsed quality gate configuration
 */
export function loadQualityConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
  sandboxPolicy?: SandboxPolicy,
): QualityGateConfig {
  let effectivePath = configPath;

  // Validate path before reading to prevent path traversal attacks
  if (sandboxPolicy != null) {
    const check = checkSandboxPath(sandboxPolicy, configPath);
    if (!check.allowed) {
      throw new PolicyDeniedError(
        check.reasonCode ?? "config.quality_denied",
        check.reasonCode ?? "config.quality_denied",
      );
    }
    effectivePath = check.normalizedPath;
  }

  try {
    const raw = readFileSync(effectivePath, "utf-8");
    const parsed = JSON.parse(raw);

    // Validate parsed config against Zod schema
    const validated = QualityGateConfigSchema.parse(parsed);

    return {
      qualityGate: {
        defaultPassThreshold: validated.qualityGate.defaultPassThreshold,
        criticalPassThreshold: validated.qualityGate.criticalPassThreshold,
        enforcement: validated.qualityGate.enforcement,
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
    };
  } catch {
    // Return default config if file doesn't exist or validation fails
    return {
      qualityGate: {
        defaultPassThreshold: 0.8,
        criticalPassThreshold: 0.95,
        enforcement: "blocking" as const,
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
  }
}
