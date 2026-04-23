import type { FeedbackSignal } from "../collector/feedback-model.js";
export interface FeedbackAnalysisSummary {
    readonly totalSignals: number;
    readonly bySeverity: Readonly<Record<string, number>>;
    readonly topSubjects: readonly string[];
}
export declare function analyzeFeedbackSignals(signals: readonly FeedbackSignal[]): FeedbackAnalysisSummary;
