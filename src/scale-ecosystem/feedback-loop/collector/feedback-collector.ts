import { newId } from "../../../platform/contracts/types/ids.js";
import { parseFeedbackSignal, type FeedbackSignal } from "../../../platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";
import { parseFeedbackBatch, type FeedbackBatch, type LearningSignal } from "./feedback-model.js";
import { SignalPreprocessor } from "./signal-preprocessor.js";

export interface FeedbackCollectorInput {
  taskId: string;
  executionId?: string | null;
  planId?: string | null;
  signals?: readonly FeedbackSignal[];
  feedbackSignals?: readonly FeedbackSignal[];
}

export class FeedbackCollector {
  private readonly preprocessor = new SignalPreprocessor();

  public collect(input: FeedbackCollectorInput): FeedbackBatch {
    const rawSignals = input.signals ?? input.feedbackSignals ?? [];
    const signals = this.preprocessor.normalize(rawSignals.map((item) => parseFeedbackSignal(item)));
    const feedbackId = newId("feedback");
    const outcome =
      signals.some((signal) => signal.category === "failure" || signal.category === "timeout")
        ? "failed"
        : signals.some((signal) => signal.category === "correction")
          ? "repairable"
          : signals.some((signal) => signal.category === "partial")
            ? "partial"
            : "completed";

    return parseFeedbackBatch({
      feedbackId,
      batchId: feedbackId,
      taskId: input.taskId,
      executionId: input.executionId ?? null,
      planId: input.planId ?? null,
      outcome,
      signals,
      emittedAt: Date.now(),
    });
  }

  public toLearningSignals(feedback: FeedbackBatch): LearningSignal[] {
    return this.preprocessor.toLearningSignals(feedback);
  }
}
