import { z } from "zod";

export const FeedbackSourceSchema = z.enum(["execution", "user", "hitl", "validation", "system"]);
export const FeedbackCategorySchema = z.enum(["success", "failure", "correction", "timeout", "partial"]);
export const FeedbackSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

export const FeedbackSignalSchema = z.object({
  signalId: z.string().min(1),
  taskId: z.string().min(1),
  source: FeedbackSourceSchema,
  category: FeedbackCategorySchema,
  severity: FeedbackSeveritySchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  stepOutputRefs: z.array(z.string()).default([]),
  timestamp: z.number().int().nonnegative(),
  /** Composite trust score [0,1] derived from source reliability, signal consistency, and validation history. */
  feedbackTrustScore: z.number().min(0).max(1).default(0.5),
  /** Individual trust factor scores for transparency. */
  trustFactors: z.object({
    sourceReliability: z.number().min(0).max(1).default(0.5),
    signalConsistency: z.number().min(0).max(1).default(0.5),
    validationHistory: z.number().min(0).max(1).default(0.5),
  }).default({}),
});

export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>;
export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;
export type FeedbackSeverity = z.infer<typeof FeedbackSeveritySchema>;
export type FeedbackSignal = z.output<typeof FeedbackSignalSchema>;

export function parseFeedbackSignal(input: unknown): FeedbackSignal {
  return FeedbackSignalSchema.parse(input);
}
