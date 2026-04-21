import type { RolloutRecord } from "../types/rollout-record.js";
export interface RolloutMetrics {
    requestCount: number;
    failureRate: number;
    p99LatencyMs: number;
    baselineP99LatencyMs: number;
    observationWindowMs?: number;
}
export interface AutoRollbackConfig {
    maxFailureRate: number;
    maxLatencyMultiplier: number;
    minimumRequestCount: number;
    minimumObservationWindowMs: number;
}
export interface AutoRollbackDecision {
    rollback: boolean;
    reasonCodes: string[];
}
export declare class AutoRollbackService {
    private readonly config;
    constructor(config?: Partial<AutoRollbackConfig>);
    evaluate(_rollout: RolloutRecord, metrics: RolloutMetrics): AutoRollbackDecision;
}
