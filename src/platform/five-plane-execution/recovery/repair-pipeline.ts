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
import { classifyFailure, shouldEscalate } from './failure-classification.js';

export type PipelineStage =
  | 'plan'
  | 'build'
  | 'review'
  | 'validate'
  | 'repair'
  | 're_validate'
  | 'release'
  | 'escalated'
  | 'completed'
  | 'failed';

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

export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
  maxRepairRounds: 2,
  maxModelEscalations: 1,
  enableAutomaticRepair: true,
};

export class RepairPipeline {
  private state: PipelineState;
  private options: PipelineOptions;

  constructor(taskCard: TaskCard, options: Partial<PipelineOptions> = {}) {
    this.options = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
    this.state = {
      taskCard,
      currentStage: 'plan',
      repairRound: 0,
      escalated: false,
      stageHistory: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  getState(): PipelineState {
    return this.state;
  }

  getTaskCard(): TaskCard {
    return this.state.taskCard;
  }

  isComplete(): boolean {
    return this.state.currentStage === 'completed' || this.state.currentStage === 'failed';
  }

  hasEscalated(): boolean {
    return this.state.escalated;
  }

  transitionTo(stage: PipelineStage): void {
    this.state = {
      ...this.state,
      currentStage: stage,
      stageHistory: [...this.state.stageHistory, stage],
      updatedAt: new Date().toISOString(),
    };
  }

  setPatchBundle(bundle: PatchBundle): void {
    this.state = {
      ...this.state,
      patchBundle: bundle,
      updatedAt: new Date().toISOString(),
    };
  }

  setReviewReport(report: ReviewReport): void {
    this.state = {
      ...this.state,
      reviewReport: report,
      updatedAt: new Date().toISOString(),
    };
  }

  setValidationReport(report: ValidationReport): void {
    this.state = {
      ...this.state,
      validationReport: report,
      updatedAt: new Date().toISOString(),
    };
  }

  setReleaseRecord(record: ReleaseRecord): void {
    this.state = {
      ...this.state,
      releaseRecord: record,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Determines if repair should be attempted or if escalation is needed.
   */
  shouldRepair(): boolean {
    const { enableAutomaticRepair, maxRepairRounds } = this.options;

    if (!enableAutomaticRepair) return false;
    if (this.state.repairRound >= maxRepairRounds) return false;
    if (this.state.taskCard.maxRepairRounds <= this.state.repairRound) return false;

    // Check if failure is repairable
    if (this.state.failureContext) {
      return this.state.failureContext.autoRepairable;
    }

    return true;
  }

  /**
   * Handles a failed validation with automatic repair decision.
   */
  handleValidationFailure(
    failureCategory: FailureContext['category'],
    validationReport: ValidationReport
  ): { action: 'repair' | 'escalate'; reason: string } {
    const context = classifyFailure(failureCategory, this.state.repairRound);

    this.state = {
      ...this.state,
      failureContext: context,
      validationReport,
    };

    if (shouldEscalate(context, this.state.taskCard.maxRepairRounds)) {
      return {
        action: 'escalate',
        reason: `Failure level ${context.level}: ${context.description}`,
      };
    }

    if (!context.autoRepairable) {
      return {
        action: 'escalate',
        reason: `Non-repairable failure: ${context.description}`,
      };
    }

    if (!this.shouldRepair()) {
      return {
        action: 'escalate',
        reason: 'Repair budget exhausted',
      };
    }

    return {
      action: 'repair',
      reason: `Attempting repair (round ${this.state.repairRound + 1}/${this.state.taskCard.maxRepairRounds})`,
    };
  }

  /**
   * Handles a failed review with automatic repair decision.
   */
  handleReviewFailure(
    failureCategory: FailureContext['category'],
    reviewReport: ReviewReport
  ): { action: 'repair' | 'escalate'; reason: string } {
    const context = classifyFailure(failureCategory, this.state.repairRound);

    this.state = {
      ...this.state,
      failureContext: context,
      reviewReport,
    };

    if (shouldEscalate(context, this.state.taskCard.maxRepairRounds)) {
      return {
        action: 'escalate',
        reason: `Failure level ${context.level}: ${context.description}`,
      };
    }

    if (!context.autoRepairable) {
      return {
        action: 'escalate',
        reason: `Non-repairable failure: ${context.description}`,
      };
    }

    return {
      action: 'repair',
      reason: `Attempting repair (round ${this.state.repairRound + 1}/${this.state.taskCard.maxRepairRounds})`,
    };
  }

  incrementRepairRound(): void {
    this.state = {
      ...this.state,
      repairRound: this.state.repairRound + 1,
      currentStage: 'repair',
      updatedAt: new Date().toISOString(),
    };
  }

  escalate(reason: string): void {
    this.state = {
      ...this.state,
      escalated: true,
      currentStage: 'escalated',
      updatedAt: new Date().toISOString(),
    };
  }

  complete(): void {
    this.state = {
      ...this.state,
      currentStage: 'completed',
      updatedAt: new Date().toISOString(),
    };
  }

  fail(reason: string): void {
    this.state = {
      ...this.state,
      currentStage: 'failed',
      updatedAt: new Date().toISOString(),
    };
  }
}
