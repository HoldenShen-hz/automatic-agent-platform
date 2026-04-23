import { type FeedbackSignal } from "../../../platform/orchestration/oapeflir/types/feedback-signal.js";
import { type FeedbackBatch, type LearningSignal } from "./feedback-model.js";
export interface FeedbackCollectorInput {
    taskId: string;
    executionId?: string | null;
    planId?: string | null;
    signals: readonly FeedbackSignal[];
}
export declare class FeedbackCollector {
    private readonly preprocessor;
    collect(input: FeedbackCollectorInput): FeedbackBatch;
    toLearningSignals(feedback: FeedbackBatch): LearningSignal[];
}
