import { shouldReplicateToRegion, type ReplicationPolicy } from "./data-replicator/index.js";
import { resolveRegionFailover } from "./failover-controller/index.js";
import { selectPreferredRegion, type RegionDescriptor } from "./region-router/index.js";

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

function includesAllCapabilities(region: RegionDescriptor, requiredCapabilities: readonly string[]): boolean {
  const capabilities = new Set((region as RegionDescriptor & { capabilities?: readonly string[] }).capabilities ?? []);
  return requiredCapabilities.every((capability) => capabilities.has(capability));
}

export class CrossRegionRoutingService {
  public route(request: CrossRegionRouteRequest): CrossRegionRouteDecision {
    const blockedRegionIds = new Set(request.policy.blockedRegionIds ?? []);
    const allowedJurisdictions = new Set(request.policy.allowedJurisdictions);
    const requiredCapabilities = request.policy.requiredCapabilities ?? [];
    const blockedRegions = request.regions
      .filter((region) =>
        blockedRegionIds.has(region.regionId)
        || !region.residencyAllowed
        || !allowedJurisdictions.has(region.jurisdiction)
        || !includesAllCapabilities(region, requiredCapabilities))
      .map((region) => region.regionId);

    const candidateDescriptors = request.regions.filter((region) => !blockedRegions.includes(region.regionId));
    const preferredRegion = request.preferredRegionId == null
      ? null
      : candidateDescriptors.find((region) => region.regionId === request.preferredRegionId) ?? null;
    const selectedRegion = preferredRegion ?? selectPreferredRegion(candidateDescriptors);
    const failover = resolveRegionFailover({
      primaryHealthy: request.primaryRegionHealthy,
      candidateRegionIds: candidateDescriptors
        .filter((region) => region.regionId !== selectedRegion?.regionId)
        .map((region) => region.regionId),
    });

    return {
      selectedRegionId: selectedRegion?.regionId ?? null,
      candidateRegions: candidateDescriptors.map((region) => region.regionId),
      residencyDecision: selectedRegion == null ? "blocked" : "allowed",
      latencyScore: selectedRegion?.latencyScore ?? null,
      recoveryTopology: {
        primaryRegionId: request.primaryRegionId ?? selectedRegion?.regionId ?? null,
        failoverRegionId: failover.targetRegionId,
        replicationTargets: request.replicationPolicy == null
          ? []
          : candidateDescriptors
            .filter((region) => shouldReplicateToRegion(request.replicationPolicy!, region.regionId))
            .map((region) => region.regionId),
      },
      blockedRegions,
    };
  }
}
