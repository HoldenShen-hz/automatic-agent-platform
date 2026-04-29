/**
 * Feedback Contract Types
 *
 * Defines the inter-plane contract for feedback signals used in execution
 * outcome evaluation. This allows P2 (AI-Ops/prompt-engine) to consume
 * feedback without direct cross-layer coupling to scale-ecosystem.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §13.5
 */

import type { FeedbackSignal } from "../../orchestration/oapeflir/types/feedback-signal.js";

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
