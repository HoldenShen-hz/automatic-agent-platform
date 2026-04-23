/**
 * Repair Pipeline - Execution Pipeline with Repair Loop
 *
 * Implements the Plan → Build → Review → Validate → Repair → Re-Validate → Release/Escalate
 * pipeline with proper state management and budget controls.
 */
import { classifyFailure, shouldEscalate } from './failure-classification.js';
export const DEFAULT_PIPELINE_OPTIONS = {
    maxRepairRounds: 2,
    maxModelEscalations: 1,
    enableAutomaticRepair: true,
};
export class RepairPipeline {
    state;
    options;
    constructor(taskCard, options = {}) {
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
    getState() {
        return this.state;
    }
    getTaskCard() {
        return this.state.taskCard;
    }
    isComplete() {
        return this.state.currentStage === 'completed' || this.state.currentStage === 'failed';
    }
    hasEscalated() {
        return this.state.escalated;
    }
    transitionTo(stage) {
        this.state = {
            ...this.state,
            currentStage: stage,
            stageHistory: [...this.state.stageHistory, stage],
            updatedAt: new Date().toISOString(),
        };
    }
    setPatchBundle(bundle) {
        this.state = {
            ...this.state,
            patchBundle: bundle,
            updatedAt: new Date().toISOString(),
        };
    }
    setReviewReport(report) {
        this.state = {
            ...this.state,
            reviewReport: report,
            updatedAt: new Date().toISOString(),
        };
    }
    setValidationReport(report) {
        this.state = {
            ...this.state,
            validationReport: report,
            updatedAt: new Date().toISOString(),
        };
    }
    setReleaseRecord(record) {
        this.state = {
            ...this.state,
            releaseRecord: record,
            updatedAt: new Date().toISOString(),
        };
    }
    /**
     * Determines if repair should be attempted or if escalation is needed.
     */
    shouldRepair() {
        const { enableAutomaticRepair, maxRepairRounds } = this.options;
        if (!enableAutomaticRepair)
            return false;
        if (this.state.repairRound >= maxRepairRounds)
            return false;
        if (this.state.taskCard.maxRepairRounds <= this.state.repairRound)
            return false;
        // Check if failure is repairable
        if (this.state.failureContext) {
            return this.state.failureContext.autoRepairable;
        }
        return true;
    }
    /**
     * Handles a failed validation with automatic repair decision.
     */
    handleValidationFailure(failureCategory, validationReport) {
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
    handleReviewFailure(failureCategory, reviewReport) {
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
    incrementRepairRound() {
        this.state = {
            ...this.state,
            repairRound: this.state.repairRound + 1,
            currentStage: 'repair',
            updatedAt: new Date().toISOString(),
        };
    }
    escalate(reason) {
        this.state = {
            ...this.state,
            escalated: true,
            currentStage: 'escalated',
            updatedAt: new Date().toISOString(),
        };
    }
    complete() {
        this.state = {
            ...this.state,
            currentStage: 'completed',
            updatedAt: new Date().toISOString(),
        };
    }
    fail(reason) {
        this.state = {
            ...this.state,
            currentStage: 'failed',
            updatedAt: new Date().toISOString(),
        };
    }
}
//# sourceMappingURL=repair-pipeline.js.map