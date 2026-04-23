import type { RolloutRecord, RolloutStatus } from "../types/rollout-record.js";
import { AutoRollbackService, type RolloutMetrics } from "./auto-rollback-service.js";
import type { ImprovementCandidate } from "./improvement-candidate-registry.js";
import type { StrategyReleaseLevel, StrategyVersion } from "./strategy-versioning.js";
export interface RolloutDecision {
    allowed: boolean;
    releaseLevel: StrategyReleaseLevel;
    reasonCode: string;
    reasonCodes: string[];
}
export interface MetricsGateDecision {
    allowed: boolean;
    rollback: boolean;
    reasonCodes: string[];
}
export declare class PolicyRolloutService {
    private readonly stateMachine;
    private readonly guardrails;
    private readonly autoRollback;
    constructor(autoRollback?: AutoRollbackService);
    decide(candidate: ImprovementCandidate, strategyVersion: StrategyVersion): RolloutDecision;
    start(candidate: ImprovementCandidate, strategyVersion: StrategyVersion, approvedBy?: string): RolloutRecord | null;
    promote(candidate: ImprovementCandidate, current: RolloutRecord, targetStatus: Exclude<RolloutStatus, "draft" | "rejected" | "rolled_back" | "paused">, metrics?: RolloutMetrics, approvedBy?: string): RolloutRecord;
    rollback(candidate: ImprovementCandidate, current: RolloutRecord, metrics: RolloutMetrics, approvedBy?: string): RolloutRecord;
    evaluateMetricsGate(current: RolloutRecord, targetStatus: RolloutStatus, metrics?: RolloutMetrics): MetricsGateDecision;
}
