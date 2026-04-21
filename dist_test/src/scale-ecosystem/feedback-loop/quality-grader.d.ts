/**
 * Feedback Quality Grader
 *
 * Assesses feedback signals for quality and suitability for model fine-tuning.
 * Filters out noise, contradictions, and low-information feedback.
 */
import type { FeedbackSignal } from "../../platform/orchestration/oapeflir/types/feedback-signal.js";
import type { LearningSignal } from "./collector/feedback-model.js";
export interface QualityScore {
    readonly overall: number;
    readonly signalQuality: number;
    readonly diversityScore: number;
    readonly informationDensity: number;
    readonly labelReliability: number;
}
export interface QualityGrade {
    readonly grade: "discard" | "low" | "medium" | "high";
    readonly score: QualityScore;
    readonly reasons: readonly string[];
}
export interface GradingOptions {
    minOverallScore?: number;
    minSignalQuality?: number;
    requireHumanSource?: boolean;
    maxAgeDays?: number;
}
export declare class FeedbackQualityGrader {
    private readonly options;
    constructor(options?: GradingOptions);
    gradeSignals(signals: readonly FeedbackSignal[]): QualityGrade;
    gradeLearningSignals(signals: readonly LearningSignal[]): QualityGrade;
    filterByGrade(signals: readonly FeedbackSignal[], minGrade?: QualityGrade["grade"]): FeedbackSignal[];
    private gradeToScore;
}
