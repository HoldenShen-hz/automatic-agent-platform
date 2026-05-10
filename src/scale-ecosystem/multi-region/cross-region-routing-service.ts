import { shouldReplicateToRegion, type ReplicationPolicy } from "./data-replicator/index.js";
import { resolveRegionFailover } from "./failover-controller/index.js";
import { selectPreferredRegion, type RegionDescriptor } from "./region-router/index.js";
import {
  ReadReplicaService,
  ReadConsistencyLevel,
  ReadRoutingMode,
} from "./read-replica-service.js";

/**
 * Consistency level for cross-region reads
 */
type CrossRegionConsistencyLevel = "eventual" | "session" | "strong";

/**
 * Request options for read routing within cross-region decisions
 */
export interface ReadReplicaRoutingOptions {
  readonly consistencyLevel: CrossRegionConsistencyLevel;
  readonly routingMode: ReadRoutingMode;
  readonly bypassCache?: boolean;
}

export interface ResidencyPolicy {
  readonly policyId: string;
  readonly allowedJurisdictions: readonly string[];
  readonly blockedRegionIds?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  /** Cross-border transfer classification - 5-step chain: local_only < jurisdiction_approved < contractual_safeguards < adequacy_decision < free_transfer */
  readonly crossBorderTransferClass: "local_only" | "jurisdiction_approved" | "contractual_safeguards" | "adequacy_decision" | "free_transfer";
}

export interface CrossRegionRouteRequest {
  readonly regions: readonly RegionDescriptor[];
  readonly policy: ResidencyPolicy;
  readonly operationType?: "read" | "write";
  readonly primaryRegionId?: string | null;
  readonly preferredRegionId?: string | null;
  readonly primaryRegionHealthy: boolean;
  readonly replicationPolicy?: ReplicationPolicy | null;
}

export interface CrossRegionRouteDecision {
  readonly decisionId: string;
  readonly selectedRegionId: string | null;
  readonly candidateRegions: readonly string[];
  readonly residencyDecision: "allowed" | "blocked";
  readonly latencyScore: number | null;
  readonly policyRef: string;
  readonly auditTrail: readonly string[];
  readonly recoveryTopology: {
    readonly primaryRegionId: string | null;
    readonly failoverRegionId: string | null;
    readonly replicationTargets: readonly string[];
  };
  readonly blockedRegions: readonly string[];
  /** Read replica routing decision when read replica service is integrated */
  readonly readReplicaDecision?: {
    readonly replicaId: string | null;
    readonly isPrimaryRoute: boolean;
    readonly waitForReplication: boolean;
    readonly consistencyLevel: CrossRegionConsistencyLevel;
  };
}

function includesAllCapabilities(region: RegionDescriptor, requiredCapabilities: readonly string[]): boolean {
  const capabilities = new Set((region as RegionDescriptor & { capabilities?: readonly string[] }).capabilities ?? []);
  return requiredCapabilities.every((capability) => capabilities.has(capability));
}

export class CrossRegionRoutingService {
  private readonly readReplicaService: ReadReplicaService | null;

  public constructor(readReplicaService?: ReadReplicaService | null) {
    this.readReplicaService = readReplicaService ?? null;
  }

  /**
   * Route with read replica integration
   */
  public routeWithReadReplica(
    request: CrossRegionRouteRequest,
    readReplicaOptions: ReadReplicaRoutingOptions,
  ): CrossRegionRouteDecision {
    const decision = this.route(request);

    // If read replica service is available and this is a read operation, enhance with replica routing
    if (this.readReplicaService && request.operationType !== "write") {
      const readDecision = this.readReplicaService.routeRead({
        operationId: decision.decisionId,
        aggregateType: "cross_region",
        aggregateId: request.policy.policyId,
        consistencyLevel: readReplicaOptions.consistencyLevel as ReadConsistencyLevel,
        routingMode: readReplicaOptions.routingMode as ReadRoutingMode,
        preferredRegionId: request.preferredRegionId === undefined ? null : request.preferredRegionId,
        bypassCache: readReplicaOptions.bypassCache ?? undefined,
      } as import("./read-replica-service.js").ReadRoutingRequest);

      return {
        ...decision,
        selectedRegionId: readDecision.selectedRegionId,
        latencyScore: readDecision.estimatedLatencyMs ?? decision.latencyScore,
        readReplicaDecision: {
          replicaId: readDecision.selectedReplicaId,
          isPrimaryRoute: readDecision.isPrimaryRoute,
          waitForReplication: readDecision.waitForReplication,
          consistencyLevel: readReplicaOptions.consistencyLevel,
        },
      };
    }

    return decision;
  }

  public route(request: CrossRegionRouteRequest): CrossRegionRouteDecision {
    const operationType = request.operationType ?? "read";
    const blockedRegionIds = new Set(request.policy.blockedRegionIds ?? []);
    const unhealthyPrimaryRegionId = !request.primaryRegionHealthy ? request.primaryRegionId ?? null : null;
    const allowedJurisdictions = new Set(request.policy.allowedJurisdictions);
    const requiredCapabilities = request.policy.requiredCapabilities ?? [];
    const blockedRegions = request.regions
      .filter((region) =>
        blockedRegionIds.has(region.regionId)
        || region.regionId === unhealthyPrimaryRegionId
        || !region.residencyAllowed
        || !allowedJurisdictions.has(region.jurisdiction)
        || !includesAllCapabilities(region, requiredCapabilities))
      .map((region) => region.regionId);

    const candidateDescriptors = request.regions.filter((region) => !blockedRegions.includes(region.regionId));
    const preferredRegion = request.preferredRegionId == null
      ? null
      : candidateDescriptors.find((region) => region.regionId === request.preferredRegionId) ?? null;
    const selectedRegion = operationType === "write"
      ? this.selectWriteRegion(candidateDescriptors, request)
      : preferredRegion ?? selectPreferredRegion(candidateDescriptors);
    const failover = resolveRegionFailover({
      primaryHealthy: request.primaryRegionHealthy,
      currentLeaderRegionId: request.primaryRegionId ?? null,
      partitionKey: request.policy.policyId,
      candidateRegionIds: candidateDescriptors
        .filter((region) => region.regionId !== selectedRegion?.regionId)
        .map((region) => region.regionId),
    });

    const auditTrail = [
      `policy:${request.policy.policyId}`,
      `operation:${operationType}`,
      `cross_border_class:${request.policy.crossBorderTransferClass}`,
      `blocked:${blockedRegions.join(",") || "none"}`,
    ];
    return {
      decisionId: `cross_region_decision:${request.policy.policyId}:${selectedRegion?.regionId ?? "blocked"}`,
      selectedRegionId: selectedRegion?.regionId ?? null,
      candidateRegions: candidateDescriptors.map((region) => region.regionId),
      residencyDecision: selectedRegion == null ? "blocked" : "allowed",
      latencyScore: selectedRegion?.latencyScore ?? null,
      policyRef: request.policy.policyId,
      auditTrail,
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

  private selectWriteRegion(
    candidateDescriptors: readonly RegionDescriptor[],
    request: CrossRegionRouteRequest,
  ): RegionDescriptor | null {
    // Writes must go to the partition leader for truth consistency
    const leaderRegion = candidateDescriptors.find(
      (region) => (region as RegionDescriptor & { isPartitionLeader?: boolean }).isPartitionLeader === true,
    );
    if (leaderRegion != null && request.primaryRegionHealthy) {
      return leaderRegion;
    }

    // If primary is unhealthy, use failover logic to find new leader
    const failoverTarget = resolveRegionFailover({
      primaryHealthy: request.primaryRegionHealthy,
      currentLeaderRegionId: request.primaryRegionId ?? null,
      partitionKey: request.policy.policyId,
      candidateRegionIds: candidateDescriptors.map((region) => region.regionId),
      preferredRegionId: request.preferredRegionId ?? null,
    }).targetRegionId;
    return failoverTarget == null
      ? null
      : candidateDescriptors.find((region) => region.regionId === failoverTarget) ?? null;
  }
}
