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

export const OAPEFLIR_STAGES = [
  "observe",
  "assess",
  "plan",
  "execute",
  "feedback",
  "learn",
  "improve",
  "release",
] as const;

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

const STAGE_ORDER: readonly OapeflirStage[] = OAPEFLIR_STAGES;

const VALID_PREDECESSORS: ReadonlyMap<OapeflirStage, readonly OapeflirStage[]> = new Map([
  ["observe", []],
  ["assess", ["observe"]],
  ["plan", ["assess"]],
  ["execute", ["plan"]],
  ["feedback", ["execute"]],
  ["learn", ["feedback"]],
  ["improve", ["learn"]],
  ["release", ["improve"]],
]);

const STAGE_ENTRY_CONDITIONS: ReadonlyMap<OapeflirStage, StageEntryCondition> = new Map([
  ["observe", { stage: "observe", requiredStatus: [], validationRequired: false }],
  ["assess", { stage: "assess", requiredStatus: ["completed"], validationRequired: true }],
  ["plan", { stage: "plan", requiredStatus: ["completed"], validationRequired: true }],
  ["execute", { stage: "execute", requiredStatus: ["completed"], validationRequired: true }],
  ["feedback", { stage: "feedback", requiredStatus: ["completed"], validationRequired: false }],
  ["learn", { stage: "learn", requiredStatus: ["completed"], validationRequired: true }],
  ["improve", { stage: "improve", requiredStatus: ["completed", "skipped"], validationRequired: true }],
  ["release", { stage: "release", requiredStatus: ["completed", "skipped"], validationRequired: true }],
]);

export class StageTransitionFSM {
  private currentStageIndex: number = 0;
  private readonly stageStatuses = new Map<OapeflirStage, StageStatus>();
  private readonly stageTimestamps = new Map<OapeflirStage, number>();

  public constructor() {
    for (const stage of STAGE_ORDER) {
      this.stageStatuses.set(stage, "pending");
    }
  }

  public getCurrentStage(): OapeflirStage {
    return STAGE_ORDER[this.currentStageIndex]!;
  }

  public getStageStatus(stage: OapeflirStage): StageStatus {
    return this.stageStatuses.get(stage) ?? "pending";
  }

  public getStageTimestamp(stage: OapeflirStage): number | undefined {
    return this.stageTimestamps.get(stage);
  }

  public canTransitionTo(targetStage: OapeflirStage): StageTransitionResult {
    const targetIndex = STAGE_ORDER.indexOf(targetStage);
    if (targetIndex < 0) {
      return {
        allowed: false,
        targetStage,
        reasonCode: "fsm.invalid_stage",
        reasonCodes: [`fsm.invalid_stage: ${targetStage}`],
      };
    }

    const validPredecessors = VALID_PREDECESSORS.get(targetStage) ?? [];
    const currentStage = this.getCurrentStage();
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    if (targetIndex > currentIndex + 1) {
      return {
        allowed: false,
        targetStage,
        reasonCode: "fsm.skip_not_allowed",
        reasonCodes: [`fsm.skip_not_allowed: cannot skip from ${currentStage} to ${targetStage}`],
      };
    }

    if (targetIndex < currentIndex) {
      return {
        allowed: false,
        targetStage,
        reasonCode: "fsm.backward_not_allowed",
        reasonCodes: [`fsm.backward_not_allowed: cannot go back from ${currentStage} to ${targetStage}`],
      };
    }

    if (targetIndex === currentIndex) {
      return {
        allowed: true,
        targetStage,
        reasonCode: "fsm.same_stage",
        reasonCodes: ["fsm.same_stage"],
      };
    }

    if (validPredecessors.length > 0 && !validPredecessors.includes(currentStage)) {
      return {
        allowed: false,
        targetStage,
        reasonCode: "fsm.invalid_predecessor",
        reasonCodes: [`fsm.invalid_predecessor: ${currentStage} is not a valid predecessor for ${targetStage}`],
      };
    }

    const entryCondition = STAGE_ENTRY_CONDITIONS.get(targetStage);
    if (entryCondition?.validationRequired) {
      for (const pred of validPredecessors) {
        const predStatus = this.stageStatuses.get(pred);
        if (predStatus && !entryCondition.requiredStatus.includes(predStatus)) {
          return {
            allowed: false,
            targetStage,
            reasonCode: "fsm.prerequisite_not_met",
            reasonCodes: [`fsm.prerequisite_not_met: ${pred} must be ${entryCondition.requiredStatus.join(" or ")} but was ${predStatus}`],
          };
        }
      }
    }

    return {
      allowed: true,
      targetStage,
      reasonCode: "fsm.transition_allowed",
      reasonCodes: [`fsm.transition_allowed: ${currentStage} → ${targetStage}`],
    };
  }

  public recordStageEntry(stage: OapeflirStage, status: StageStatus = "pending"): void {
    this.stageStatuses.set(stage, status);
    this.stageTimestamps.set(stage, Date.now());
  }

  public recordStageCompletion(stage: OapeflirStage): void {
    this.stageStatuses.set(stage, "completed");
    this.stageTimestamps.set(stage, Date.now());

    const stageIndex = STAGE_ORDER.indexOf(stage);
    if (stageIndex >= this.currentStageIndex) {
      this.currentStageIndex = stageIndex + 1;
    }
  }

  public recordStageSkipped(stage: OapeflirStage, reasonCode: string): void {
    this.stageStatuses.set(stage, "skipped");
    this.stageTimestamps.set(stage, Date.now());

    const stageIndex = STAGE_ORDER.indexOf(stage);
    if (stageIndex >= this.currentStageIndex) {
      this.currentStageIndex = stageIndex + 1;
    }
  }

  public recordStageError(stage: OapeflirStage): void {
    this.stageStatuses.set(stage, "error");
    this.stageTimestamps.set(stage, Date.now());
  }

  public getNextStage(): OapeflirStage | null {
    if (this.currentStageIndex >= STAGE_ORDER.length) {
      return null;
    }
    return STAGE_ORDER[this.currentStageIndex]!;
  }

  public isComplete(): boolean {
    return this.currentStageIndex >= STAGE_ORDER.length;
  }

  public getExecutionSummary(): Record<OapeflirStage, { status: StageStatus; timestamp?: number }> {
    const summary = {} as Record<OapeflirStage, { status: StageStatus; timestamp?: number }>;
    for (const stage of STAGE_ORDER) {
      const timestamp = this.stageTimestamps.get(stage);
      summary[stage] = {
        status: this.stageStatuses.get(stage) ?? "pending",
        ...(timestamp !== undefined ? { timestamp } : {}),
      };
    }
    return summary;
  }

  public reset(): void {
    this.currentStageIndex = 0;
    for (const stage of STAGE_ORDER) {
      this.stageStatuses.set(stage, "pending");
      this.stageTimestamps.delete(stage);
    }
  }
}

export function createStageTransitionFSM(): StageTransitionFSM {
  return new StageTransitionFSM();
}
