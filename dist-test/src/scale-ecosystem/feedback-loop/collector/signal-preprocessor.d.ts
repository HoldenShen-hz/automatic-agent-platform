import { type FeedbackSignal } from "../../../platform/orchestration/oapeflir/types/feedback-signal.js";
import type { FeedbackBatch } from "./feedback-model.js";
import { type LearningSignal } from "./feedback-model.js";
export interface SignalPreprocessorOptions {
    includeInformationalSignals?: boolean;
}
export declare class SignalPreprocessor {
    deduplicate(signals: readonly FeedbackSignal[]): FeedbackSignal[];
    mergeCorrelated(signals: readonly FeedbackSignal[]): FeedbackSignal[];
    normalize(signals: readonly FeedbackSignal[]): FeedbackSignal[];
    toLearningSignals(feedback: FeedbackBatch, options?: SignalPreprocessorOptions): LearningSignal[];
}
