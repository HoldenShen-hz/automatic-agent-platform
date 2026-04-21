/**
 * Fine-tuning Dataset Exporter
 *
 * Exports high-quality feedback signals as JSONL datasets
 * suitable for model fine-tuning pipelines.
 */
import type { FeedbackSignal } from "../../platform/orchestration/oapeflir/types/feedback-signal.js";
import type { LearningSignal } from "./collector/feedback-model.js";
import type { FeedbackImprovementService } from "./feedback-improvement-service.js";
import type { FeedbackQualityGrader } from "./quality-grader.js";
export interface FineTuningExample {
    readonly id: string;
    readonly taskId: string;
    readonly input: string;
    readonly output: string;
    readonly feedbackType: string;
    readonly confidence: number;
    readonly sourceSignals: readonly string[];
    readonly metadata: {
        readonly source: string;
        readonly category: string;
        readonly severity: string;
        readonly reasonCode: string | null;
        readonly stepRefs: readonly string[];
        readonly timestamp: number;
    };
}
export interface FineTuningDataset {
    readonly datasetId: string;
    readonly exportedAt: string;
    readonly totalExamples: number;
    readonly highQualityCount: number;
    readonly mediumQualityCount: number;
    readonly examples: readonly FineTuningExample[];
}
export interface ExportOptions {
    minQualityGrade?: "low" | "medium" | "high";
    maxExamples?: number;
    includeMetadata?: boolean;
}
export declare class FineTuningExporter {
    private idCounter;
    exportFromSignals(signals: readonly FeedbackSignal[], grader: FeedbackQualityGrader, options?: ExportOptions): FineTuningDataset;
    exportFromLearningSignals(learningSignals: readonly LearningSignal[], grader: FeedbackQualityGrader, options?: ExportOptions): FineTuningDataset;
    exportFromImprovementService(service: FeedbackImprovementService, grader: FeedbackQualityGrader, options?: ExportOptions): FineTuningDataset;
    exportToJsonl(dataset: FineTuningDataset): string;
    exportToJson(dataset: FineTuningDataset): string;
    private buildDataset;
    reset(): void;
}
