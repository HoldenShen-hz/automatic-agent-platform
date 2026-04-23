/**
 * @fileoverview OAPEFLIR Stage Transition FSM
 *
 * Defines the finite state machine for OAPEFLIR 8-stage transitions:
 * Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
 *
 * Each stage has defined entry conditions, valid predecessors, valid successors,
 * and transition guards that determine whether progression is allowed.
 */
import type { OapeflirStage } from "./stage-timeline.js";
export declare const OAPEFLIR_STAGES: readonly ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"];
export type { OapeflirStage };
export type StageStatus = "pending" | "completed" | "skipped" | "error" | "blocked";
export interface StageTransitionContext {
    taskId: string;
    previousStage?: OapeflirStage;
    validationResult?: {
        ok: boolean;
        errorCode?: string;
    };
    metrics?: Record<string, unknown>;
}
export interface StageTransitionResult {
    allowed: boolean;
    targetStage: OapeflirStage;
    reasonCode: string;
    reasonCodes: string[];
}
export interface StageEntryCondition {
    stage: OapeflirStage;
    requiredStatus: StageStatus[];
    validationRequired: boolean;
}
export declare class StageTransitionFSM {
    private currentStageIndex;
    private readonly stageStatuses;
    private readonly stageTimestamps;
    constructor();
    getCurrentStage(): OapeflirStage;
    getStageStatus(stage: OapeflirStage): StageStatus;
    getStageTimestamp(stage: OapeflirStage): number | undefined;
    canTransitionTo(targetStage: OapeflirStage): StageTransitionResult;
    recordStageEntry(stage: OapeflirStage, status?: StageStatus): void;
    recordStageCompletion(stage: OapeflirStage): void;
    recordStageSkipped(stage: OapeflirStage, reasonCode: string): void;
    recordStageError(stage: OapeflirStage): void;
    getNextStage(): OapeflirStage | null;
    isComplete(): boolean;
    getExecutionSummary(): Record<OapeflirStage, {
        status: StageStatus;
        timestamp?: number;
    }>;
    reset(): void;
}
export declare function createStageTransitionFSM(): StageTransitionFSM;
