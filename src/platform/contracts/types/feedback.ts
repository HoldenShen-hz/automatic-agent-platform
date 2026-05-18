/**
 * Feedback Contract Types
 *
 * Defines the inter-plane contract for feedback signals used in execution
 * outcome evaluation. This allows P2 (AI-Ops/prompt-engine) to consume
 * feedback without direct cross-layer coupling to scale-ecosystem.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §13.5
 */

import { z } from "zod";

export const FeedbackSourceSchema = z.enum(["execution", "user", "hitl", "validation", "system"]);
export const FeedbackCategorySchema = z.enum(["success", "failure", "correction", "timeout", "partial", "blocker", "regression"]);
export const FeedbackSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

export const FeedbackTrustFactorsSchema = z.object({
  sourceReliability: z.number().min(0).max(1).default(0.5),
  historicalAccuracy: z.number().min(0).max(1).default(0.5),
  authenticatedSource: z.boolean().default(false),
  attackSurfaceExposure: z.number().min(0).max(1).default(0.5),
  holdoutOverlap: z.number().min(0).max(1).default(0),
});

export const TrustScoreSchema = z.object({
  overallScore: z.number().min(0).max(1),
  sourceReliability: z.number().min(0).max(1).default(0.5),
  historicalAccuracy: z.number().min(0).max(1).default(0.5),
  adversarialRisk: z.enum(["low", "medium", "high"]).default("low"),
  passedSanityCheck: z.boolean().default(true),
});

export type FeedbackTrustFactors = z.output<typeof FeedbackTrustFactorsSchema>;
export type TrustScore = z.output<typeof TrustScoreSchema>;
export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>;
export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;
export type FeedbackSeverity = z.infer<typeof FeedbackSeveritySchema>;

export const FeedbackSignalSchema = z.object({
  signalId: z.string().min(1),
  taskId: z.string().min(1),
  source: FeedbackSourceSchema,
  category: FeedbackCategorySchema,
  severity: FeedbackSeveritySchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  stepOutputRefs: z.array(z.string()).default([]),
  timestamp: z.preprocess((value) => {
    if (typeof value === "string") {
      const parsedDate = Date.parse(value);
      if (!Number.isNaN(parsedDate)) {
        return parsedDate;
      }
      const parsedNumber = Number(value);
      if (!Number.isNaN(parsedNumber)) {
        return parsedNumber;
      }
    }
    return value;
  }, z.number().int().nonnegative()),
  trustScore: TrustScoreSchema.optional(),
  feedbackTrustScore: z.number().min(0).max(1).optional(),
  trustFactors: FeedbackTrustFactorsSchema.default({}),
}).transform((signal) => ({
  ...signal,
  feedbackTrustScore: signal.trustScore?.overallScore ?? signal.feedbackTrustScore ?? deriveFeedbackTrustScore(signal.trustFactors),
}));

export type FeedbackSignal = z.output<typeof FeedbackSignalSchema>;

/**
 * Feedback batch outcome classification.
 */
export type FeedbackBatchOutcome = "completed" | "failed" | "repairable" | "escalated" | "partial";

/**
 * Feedback batch - aggregated feedback signals for a task execution.
 *
 * This is the canonical contract type for feedback data consumed by
 * execution outcome evaluators in the prompt-engine layer.
 */
export interface FeedbackBatch {
  readonly feedbackId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly planId: string | null;
  readonly outcome: FeedbackBatchOutcome;
  readonly signals: readonly FeedbackSignal[];
  readonly emittedAt: number;
}

/**
 * Creates a minimal FeedbackBatch for testing or fallback scenarios.
 */
export function createEmptyFeedbackBatch(taskId: string): FeedbackBatch {
  return {
    feedbackId: `fb_${taskId}`,
    taskId,
    executionId: null,
    planId: null,
    outcome: "failed",
    signals: [],
    emittedAt: Date.now(),
  };
}

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
