export interface SlaObservation {
    readonly latencyMs: number;
    readonly successRate: number;
    readonly queueWaitMs: number;
}
export interface SlaCommitment {
    readonly maxLatencyMs: number;
    readonly minSuccessRate: number;
    readonly maxQueueWaitMs: number;
}
export declare function detectSlaBreach(observation: SlaObservation, commitment: SlaCommitment): string[];
