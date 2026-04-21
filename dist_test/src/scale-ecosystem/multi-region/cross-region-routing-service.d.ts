import { type ReplicationPolicy } from "./data-replicator/index.js";
import { type RegionDescriptor } from "./region-router/index.js";
export interface ResidencyPolicy {
    readonly policyId: string;
    readonly allowedJurisdictions: readonly string[];
    readonly blockedRegionIds?: readonly string[];
    readonly requiredCapabilities?: readonly string[];
    readonly allowCrossBorder: boolean;
}
export interface CrossRegionRouteRequest {
    readonly regions: readonly RegionDescriptor[];
    readonly policy: ResidencyPolicy;
    readonly primaryRegionId?: string | null;
    readonly preferredRegionId?: string | null;
    readonly primaryRegionHealthy: boolean;
    readonly replicationPolicy?: ReplicationPolicy | null;
}
export interface CrossRegionRouteDecision {
    readonly selectedRegionId: string | null;
    readonly candidateRegions: readonly string[];
    readonly residencyDecision: "allowed" | "blocked";
    readonly latencyScore: number | null;
    readonly recoveryTopology: {
        readonly primaryRegionId: string | null;
        readonly failoverRegionId: string | null;
        readonly replicationTargets: readonly string[];
    };
    readonly blockedRegions: readonly string[];
}
export declare class CrossRegionRoutingService {
    route(request: CrossRegionRouteRequest): CrossRegionRouteDecision;
}
