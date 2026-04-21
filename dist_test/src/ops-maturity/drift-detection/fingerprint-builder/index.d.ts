export interface BehaviorFingerprintInput {
    agentId: string;
    tools: readonly string[];
    failureCategories: readonly string[];
    averageLatencyMs: number;
    averageCostUsd: number;
}
export interface BehaviorFingerprint {
    fingerprintId: string;
    normalizedFeatures: string[];
    hash: string;
}
export declare class BehaviorFingerprintBuilder {
    build(input: BehaviorFingerprintInput): BehaviorFingerprint;
}
