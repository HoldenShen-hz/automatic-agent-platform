import type { RolloutRecord, RolloutStatus } from "../../types/rollout-record.js";
import type { ImprovementCandidate } from "../improvement-candidate-registry.js";
import { PolicyRolloutService } from "../policy-rollout-service.js";
import type { RolloutMetrics } from "../auto-rollback-service.js";
export interface ScheduledRollout {
    candidate: ImprovementCandidate;
    record: RolloutRecord;
    approvedBy?: string;
}
export interface RolloutSchedulerMetricsProvider {
    readMetrics(record: RolloutRecord): Promise<RolloutMetrics | null | undefined> | RolloutMetrics | null | undefined;
}
export interface RolloutSchedulerDecision {
    action: "promote" | "rollback" | "wait" | "blocked";
    record: RolloutRecord;
    nextStatus: RolloutStatus | null;
    reasonCodes: string[];
    metrics: RolloutMetrics | null;
}
export interface RolloutSchedulerOptions {
    rolloutService?: PolicyRolloutService;
    metricsProvider?: RolloutSchedulerMetricsProvider | null;
    now?: () => number;
    minimumStageDwellMs?: Partial<Record<RolloutStatus, number>>;
}
export declare class RolloutScheduler {
    private readonly rolloutService;
    private readonly metricsProvider;
    private readonly now;
    private readonly minimumStageDwellMs;
    constructor(options?: RolloutSchedulerOptions);
    advance(input: ScheduledRollout): Promise<RolloutSchedulerDecision>;
    advanceMany(inputs: readonly ScheduledRollout[]): Promise<RolloutSchedulerDecision[]>;
}
