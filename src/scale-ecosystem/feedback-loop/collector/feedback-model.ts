import { z } from "zod";

import { FeedbackSignalSchema, type FeedbackSignal } from "../../../platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

export const FeedbackBatchOutcomeSchema = z.enum(["completed", "failed", "repairable", "escalated", "partial"]);

export const FeedbackBatchSchema = z.object({
  feedbackId: z.string().min(1),
  batchId: z.string().min(1).optional(),
  taskId: z.string().min(1),
  executionId: z.string().nullable().default(null),
  planId: z.string().nullable().default(null),
  outcome: FeedbackBatchOutcomeSchema,
  signals: z.array(FeedbackSignalSchema).default([]),
  emittedAt: z.number().int().nonnegative(),
});

export const LearningSignalSchema = z.object({
  learningSignalId: z.string().min(1),
  taskId: z.string().min(1),
  sourceFeedbackId: z.string().min(1),
  learningType: z.enum(["failure_pattern", "user_correction", "recovery_playbook", "model_retraining", "dataset_gap"]),
  confidence: z.number().min(0).max(1),
  valueSummary: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
  sourceSignalIds: z.array(z.string()).default([]),
  relatedSignalIds: z.array(z.string()).default([]),
  evidence: z.record(z.string(), z.unknown()).default({}),
  generatedAt: z.number().int().nonnegative(),
});

export type FeedbackBatchOutcome = z.infer<typeof FeedbackBatchOutcomeSchema>;
export type FeedbackBatch = z.infer<typeof FeedbackBatchSchema>;
export type LearningSignal = z.infer<typeof LearningSignalSchema>;
export type { FeedbackSignal };

export function parseFeedbackBatch(input: unknown): FeedbackBatch {
  return FeedbackBatchSchema.parse(input);
}

export function parseLearningSignal(input: unknown): LearningSignal {
  return LearningSignalSchema.parse(input);
}
