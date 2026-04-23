export interface RegionFailoverInput {
    readonly primaryHealthy: boolean;
    readonly candidateRegionIds: readonly string[];
    readonly primaryLatencyMs?: number;
    readonly maxAcceptableLatencyMs?: number;
    readonly primaryErrorRate?: number;
    readonly maxAcceptableErrorRate?: number;
    readonly preferredRegionId?: string | null;
}
export interface RegionFailoverDecision {
    readonly shouldFailover: boolean;
    readonly targetRegionId: string | null;
    readonly rationale: string;
}
export declare function resolveRegionFailover(input: RegionFailoverInput): RegionFailoverDecision;
