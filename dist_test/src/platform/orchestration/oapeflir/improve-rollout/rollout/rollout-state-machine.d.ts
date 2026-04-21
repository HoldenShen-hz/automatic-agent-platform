import { type RolloutLevel, type RolloutRecord, type RolloutStatus } from "../../types/rollout-record.js";
import type { ImprovementCandidate } from "../improvement-candidate-registry.js";
export interface RolloutTransitionOptions {
    approvedBy?: string | undefined;
    strategyVersionId?: string | null | undefined;
    guardrailReasonCodes?: readonly string[] | undefined;
    currentStatus?: RolloutStatus | undefined;
    targetStatus?: RolloutStatus | undefined;
}
export declare class RolloutStateMachine {
    transition(candidate: ImprovementCandidate, nextLevel: RolloutLevel, options?: RolloutTransitionOptions): RolloutRecord;
}
