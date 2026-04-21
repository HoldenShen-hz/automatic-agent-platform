/**
 * @fileoverview OAPEFLIR Stage Transition FSM
 *
 * Defines the finite state machine for OAPEFLIR 8-stage transitions:
 * Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
 *
 * Each stage has defined entry conditions, valid predecessors, valid successors,
 * and transition guards that determine whether progression is allowed.
 */
export const OAPEFLIR_STAGES = [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
];
const STAGE_ORDER = OAPEFLIR_STAGES;
const VALID_PREDECESSORS = new Map([
    ["observe", []],
    ["assess", ["observe"]],
    ["plan", ["assess"]],
    ["execute", ["plan"]],
    ["feedback", ["execute"]],
    ["learn", ["feedback"]],
    ["improve", ["learn"]],
    ["release", ["improve"]],
]);
const STAGE_ENTRY_CONDITIONS = new Map([
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
    currentStageIndex = 0;
    stageStatuses = new Map();
    stageTimestamps = new Map();
    constructor() {
        for (const stage of STAGE_ORDER) {
            this.stageStatuses.set(stage, "pending");
        }
    }
    getCurrentStage() {
        return STAGE_ORDER[this.currentStageIndex];
    }
    getStageStatus(stage) {
        return this.stageStatuses.get(stage) ?? "pending";
    }
    getStageTimestamp(stage) {
        return this.stageTimestamps.get(stage);
    }
    canTransitionTo(targetStage) {
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
    recordStageEntry(stage, status = "pending") {
        this.stageStatuses.set(stage, status);
        this.stageTimestamps.set(stage, Date.now());
    }
    recordStageCompletion(stage) {
        this.stageStatuses.set(stage, "completed");
        this.stageTimestamps.set(stage, Date.now());
        const stageIndex = STAGE_ORDER.indexOf(stage);
        if (stageIndex >= this.currentStageIndex) {
            this.currentStageIndex = stageIndex + 1;
        }
    }
    recordStageSkipped(stage, reasonCode) {
        this.stageStatuses.set(stage, "skipped");
        this.stageTimestamps.set(stage, Date.now());
        const stageIndex = STAGE_ORDER.indexOf(stage);
        if (stageIndex >= this.currentStageIndex) {
            this.currentStageIndex = stageIndex + 1;
        }
    }
    recordStageError(stage) {
        this.stageStatuses.set(stage, "error");
        this.stageTimestamps.set(stage, Date.now());
    }
    getNextStage() {
        if (this.currentStageIndex >= STAGE_ORDER.length) {
            return null;
        }
        return STAGE_ORDER[this.currentStageIndex];
    }
    isComplete() {
        return this.currentStageIndex >= STAGE_ORDER.length;
    }
    getExecutionSummary() {
        const summary = {};
        for (const stage of STAGE_ORDER) {
            const timestamp = this.stageTimestamps.get(stage);
            summary[stage] = {
                status: this.stageStatuses.get(stage) ?? "pending",
                ...(timestamp !== undefined ? { timestamp } : {}),
            };
        }
        return summary;
    }
    reset() {
        this.currentStageIndex = 0;
        for (const stage of STAGE_ORDER) {
            this.stageStatuses.set(stage, "pending");
            this.stageTimestamps.delete(stage);
        }
    }
}
export function createStageTransitionFSM() {
    return new StageTransitionFSM();
}
//# sourceMappingURL=stage-transition-fsm.js.map