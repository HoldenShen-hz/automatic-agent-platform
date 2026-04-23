import { newId } from "../../../platform/contracts/types/ids.js";
import { parseFeedbackSignal } from "../../../platform/orchestration/oapeflir/types/feedback-signal.js";
import { parseFeedbackBatch } from "./feedback-model.js";
import { SignalPreprocessor } from "./signal-preprocessor.js";
export class FeedbackCollector {
    preprocessor = new SignalPreprocessor();
    collect(input) {
        const signals = this.preprocessor.normalize(input.signals.map((item) => parseFeedbackSignal(item)));
        const outcome = signals.some((signal) => signal.category === "failure" || signal.category === "timeout")
            ? "failed"
            : signals.some((signal) => signal.category === "correction")
                ? "repairable"
                : signals.some((signal) => signal.category === "partial")
                    ? "partial"
                    : "completed";
        return parseFeedbackBatch({
            feedbackId: newId("feedback"),
            taskId: input.taskId,
            executionId: input.executionId ?? null,
            planId: input.planId ?? null,
            outcome,
            signals,
            emittedAt: Date.now(),
        });
    }
    toLearningSignals(feedback) {
        return this.preprocessor.toLearningSignals(feedback);
    }
}
//# sourceMappingURL=feedback-collector.js.map