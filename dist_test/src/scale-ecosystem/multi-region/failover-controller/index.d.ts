export interface RegionFailoverInput {
    readonly primaryHealthy: boolean;
    readonly candidateRegionIds: readonly string[];
}
export interface RegionFailoverDecision {
    readonly shouldFailover: boolean;
    readonly targetRegionId: string | null;
}
export declare function resolveRegionFailover(input: RegionFailoverInput): RegionFailoverDecision;
