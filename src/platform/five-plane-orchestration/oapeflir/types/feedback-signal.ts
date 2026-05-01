import { z } from "zod";

export const FeedbackSourceSchema = z.enum(["execution", "user", "hitl", "validation", "system"]);
export const FeedbackCategorySchema = z.enum(["success", "failure", "correction", "timeout", "partial", "blocker", "regression"]);
export const FeedbackSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

/**
 * Trust score for feedback signals per §56.2.
 * Used to filter low-trust/adversarial feedback from entering the learning pipeline.
 */
export const FeedbackTrustScoreSchema = z.object({
  /** Composite trust score 0-1; signals below threshold are excluded from learning */
  overallScore: z.number().min(0).max(1),
  /** Trustworthiness of the feedback source (execution engine, user, HITL, etc.) */
  sourceReliability: z.number().min(0).max(1),
  /** Historical accuracy of this source/class of feedback */
  historicalAccuracy: z.number().min(0).max(1),
  /** Attack surface indicator: higher values indicate more adversarial exposure */
  adversarialRisk: z.enum(["low", "medium", "high", "critical"]),
  /** Whether this signal passed basic sanity checks */
  passedSanityCheck: z.boolean(),
});

export type FeedbackTrustScore = z.output<typeof FeedbackTrustScoreSchema>;

export const FeedbackSignalSchema = z.object({
  signalId: z.string().min(1),
  taskId: z.string().min(1),
  source: FeedbackSourceSchema,
  category: FeedbackCategorySchema,
  severity: FeedbackSeveritySchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  stepOutputRefs: z.array(z.string()).default([]),
  timestamp: z.number().int().nonnegative(),
  /** §56.2: Trust score required to filter low-trust/adversarial feedback from learning pipeline */
  trustScore: FeedbackTrustScoreSchema,
  /** §56.2: Evidence refs required for learning pipeline attribution */
  evidenceRefs: z.array(z.string()).default([]),
});

export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>;
export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;
export type FeedbackSeverity = z.infer<typeof FeedbackSeveritySchema>;
export type FeedbackSignal = z.output<typeof FeedbackSignalSchema>;

/**
 * Parses and validates a feedback signal, returning null if trust score is missing
 * or below threshold. Callers should check trustScore before processing.
 */
export function parseFeedbackSignal(input: unknown): FeedbackSignal {
  return FeedbackSignalSchema.parse(input);
}

/**
 * Filters feedback signals by trust score threshold.
 * Returns false if trust score is missing or below the minimum threshold.
 */
export function isTrustedFeedbackSignal(
  signal: FeedbackSignal,
  minTrustScore = 0.3,
): boolean {
  if (!signal.trustScore) {
    return false;
  }
  return signal.trustScore.overallScore >= minTrustScore;
}
