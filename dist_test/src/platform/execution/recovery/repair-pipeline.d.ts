/**
 * Repair Pipeline - Execution Pipeline with Repair Loop
 *
 * Implements the Plan → Build → Review → Validate → Repair → Re-Validate → Release/Escalate
 * pipeline with proper state management and budget controls.
 */
import type { TaskCard } from './task-card.js';
import type { PatchBundle } from './patch-bundle.js';
import type { ReviewReport } from './review-report.js';
import type { ValidationReport } from './validation-report.js';
import type { ReleaseRecord } from './release-record.js';
import type { FailureContext } from './failure-classification.js';
export type PipelineStage = 'plan' | 'build' | 'review' | 'validate' | 'repair' | 're_validate' | 'release' | 'escalated' | 'completed' | 'failed';
export interface PipelineState {
    taskCard: TaskCard;
    currentStage: PipelineStage;
    patchBundle?: PatchBundle;
    reviewReport?: ReviewReport;
    validationReport?: ValidationReport;
    releaseRecord?: ReleaseRecord;
    repairRound: number;
    escalated: boolean;
    failureContext?: FailureContext;
    stageHistory: readonly PipelineStage[];
    startedAt: string;
    updatedAt: string;
}
export interface PipelineOptions {
    maxRepairRounds: number;
    maxModelEscalations: number;
    enableAutomaticRepair: boolean;
}
export declare const DEFAULT_PIPELINE_OPTIONS: PipelineOptions;
export declare class RepairPipeline {
    private state;
    private options;
    constructor(taskCard: TaskCard, options?: Partial<PipelineOptions>);
    getState(): PipelineState;
    getTaskCard(): TaskCard;
    isComplete(): boolean;
    hasEscalated(): boolean;
    transitionTo(stage: PipelineStage): void;
    setPatchBundle(bundle: PatchBundle): void;
    setReviewReport(report: ReviewReport): void;
    setValidationReport(report: ValidationReport): void;
    setReleaseRecord(record: ReleaseRecord): void;
    /**
     * Determines if repair should be attempted or if escalation is needed.
     */
    shouldRepair(): boolean;
    /**
     * Handles a failed validation with automatic repair decision.
     */
    handleValidationFailure(failureCategory: FailureContext['category'], validationReport: ValidationReport): {
        action: 'repair' | 'escalate';
        reason: string;
    };
    /**
     * Handles a failed review with automatic repair decision.
     */
    handleReviewFailure(failureCategory: FailureContext['category'], reviewReport: ReviewReport): {
        action: 'repair' | 'escalate';
        reason: string;
    };
    incrementRepairRound(): void;
    escalate(reason: string): void;
    complete(): void;
    fail(reason: string): void;
}
