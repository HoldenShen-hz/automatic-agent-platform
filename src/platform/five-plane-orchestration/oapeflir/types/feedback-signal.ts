import { z } from "zod";

export const FeedbackSourceSchema = z.enum(["execution", "user", "hitl", "validation", "system"]);
// R19-14 fix: Add blocker/regression categories for §31 contamination check and incident regression
export const FeedbackCategorySchema = z.enum(["success", "failure", "correction", "timeout", "partial", "blocker", "regression"]);
export const FeedbackSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

export const FeedbackTrustFactorsSchema = z.object({
  sourceReliability: z.number().min(0).max(1).default(0.5),
  historicalAccuracy: z.number().min(0).max(1).default(0.5),
  authenticatedSource: z.boolean().default(false),
  attackSurfaceExposure: z.number().min(0).max(1).default(0.5),
  holdoutOverlap: z.number().min(0).max(1).default(0),
});

/** TrustScore object structure used in FeedbackSignal */
export const TrustScoreSchema = z.object({
  overallScore: z.number().min(0).max(1),
  sourceReliability: z.number().min(0).max(1).default(0.5),
  historicalAccuracy: z.number().min(0).max(1).default(0.5),
  adversarialRisk: z.enum(["low", "medium", "high"]).default("low"),
  passedSanityCheck: z.boolean().default(true),
});

export const DIRECT_PROMOTION_TRUST_THRESHOLD = 0.65;

export type FeedbackTrustFactors = z.output<typeof FeedbackTrustFactorsSchema>;
export type TrustScore = z.output<typeof TrustScoreSchema>;

export function deriveFeedbackTrustScore(trustFactors: FeedbackTrustFactors): number {
  const weightedScore = (
    trustFactors.sourceReliability * 0.3
    + trustFactors.historicalAccuracy * 0.3
    + (trustFactors.authenticatedSource ? 1 : 0) * 0.15
    + (1 - trustFactors.attackSurfaceExposure) * 0.15
    + (1 - trustFactors.holdoutOverlap) * 0.1
  );
  return Number(Math.max(0, Math.min(1, weightedScore)).toFixed(4));
}

export const FeedbackSignalSchema = z.object({
  signalId: z.string().min(1),
  taskId: z.string().min(1),
  source: FeedbackSourceSchema,
  category: FeedbackCategorySchema,
  severity: FeedbackSeveritySchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  stepOutputRefs: z.array(z.string()).default([]),
  timestamp: z.number().int().nonnegative(),
  /** Trust score object with overallScore and individual factors. */
  trustScore: TrustScoreSchema.optional(),
  /** @deprecated Use trustScore.overallScore instead - composite trust score [0,1] derived from trust factors. */
  feedbackTrustScore: z.number().min(0).max(1).optional(),
  trustFactors: FeedbackTrustFactorsSchema.default({}),
}).transform((signal) => ({
  ...signal,
  // If trustScore is provided, compute feedbackTrustScore from its overallScore
  // Otherwise compute from trustFactors
  feedbackTrustScore: signal.trustScore?.overallScore ?? signal.feedbackTrustScore ?? deriveFeedbackTrustScore(signal.trustFactors),
}));

export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>;
export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;
export type FeedbackSeverity = z.infer<typeof FeedbackSeveritySchema>;
export type FeedbackSignal = z.output<typeof FeedbackSignalSchema>;

export interface FeedbackPromotionEligibility {
  readonly eligible: boolean;
  readonly effectiveTrustScore: number;
  readonly reasons: readonly string[];
}

export function getFeedbackPromotionEligibility(signal: FeedbackSignal): FeedbackPromotionEligibility {
  const reasons: string[] = [];
  if (signal.feedbackTrustScore < DIRECT_PROMOTION_TRUST_THRESHOLD) {
    reasons.push("trust_score_below_threshold");
  }
  if (!signal.trustFactors.authenticatedSource) {
    reasons.push("unauthenticated_source");
  }
  if (signal.trustFactors.attackSurfaceExposure > 0.5) {
    reasons.push("attack_surface_too_broad");
  }
  if (signal.trustFactors.holdoutOverlap > 0) {
    reasons.push("holdout_overlap_detected");
  }

  return {
    eligible: reasons.length === 0,
    effectiveTrustScore: signal.feedbackTrustScore,
    reasons,
  };
}

export function isFeedbackSignalEligibleForDirectPromotion(signal: FeedbackSignal): boolean {
  return getFeedbackPromotionEligibility(signal).eligible;
}

export function parseFeedbackSignal(input: unknown): FeedbackSignal {
  return FeedbackSignalSchema.parse(input);
}
