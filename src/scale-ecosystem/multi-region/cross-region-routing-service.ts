import { shouldReplicateToRegion, type ReplicationPolicy } from "./data-replicator/index.js";
import { resolveRegionFailover } from "./failover-controller/index.js";
import { selectPreferredRegion, type RegionDescriptor } from "./region-router/index.js";
import {
  ReadReplicaService,
  ReadConsistencyLevel,
  ReadRoutingMode,
} from "./read-replica-service.js";

/**
 * Request options for read routing within cross-region decisions
 */
export interface ReadReplicaRoutingOptions {
  readonly consistencyLevel: ReadConsistencyLevel;
  readonly routingMode: ReadRoutingMode;
  readonly bypassCache?: boolean;
}

export interface ResidencyPolicy {
  readonly policyId: string;
  readonly allowedJurisdictions: readonly string[];
  readonly blockedRegionIds?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  readonly allowCrossBorder?: boolean;
  readonly dataCategories?: readonly string[];
  /** Cross-border transfer classification - 5-step chain: local_only < jurisdiction_approved < contractual_safeguards < adequacy_decision < free_transfer */
  readonly crossBorderTransferClass?: "local_only" | "jurisdiction_approved" | "contractual_safeguards" | "adequacy_decision" | "free_transfer";
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
  readonly crossBorderTransferChain?: CrossBorderTransferChain;
  /** Read replica routing decision when read replica service is integrated */
  readonly readReplicaDecision?: {
    readonly replicaId: string | null;
    readonly isPrimaryRoute: boolean;
    readonly waitForReplication: boolean;
    readonly consistencyLevel: ReadConsistencyLevel;
  };
}

export interface CrossBorderTransferChain {
  readonly chainStepResults: {
    readonly jurisdictionClassification: {
      readonly sourceJurisdiction: string;
      readonly targetJurisdiction: string;
      readonly crossBorderRequired: boolean;
    };
    readonly impactAssessment: {
      readonly impactScore: number;
      readonly dataCategories: readonly string[];
      readonly regulatoryFlags: readonly string[];
    };
    readonly mechanismSelection: {
      readonly selectedMechanism: "local_only" | "encrypted_pipeline" | "contractual_safeguards" | "federated_query";
      readonly encryptionRequired: boolean;
      readonly auditLoggingRequired: boolean;
      readonly allowedByPolicy: boolean;
    };
    readonly dataMinimization: {
      readonly fieldsToRedact: readonly string[];
      readonly aggregationLevel: "none" | "pseudonymized" | "fully_aggregated";
      readonly minimizationApplied: boolean;
    };
    readonly outputScan: {
      readonly passed: boolean;
      readonly violations: readonly string[];
    };
  };
  readonly overallDecision: "allowed" | "blocked" | "requires_review";
  readonly blockedReason: string | null;
  readonly auditTrail: readonly string[];
}

function includesAllCapabilities(region: RegionDescriptor, requiredCapabilities: readonly string[]): boolean {
  const capabilities = new Set(region.capabilities ?? []);
  return requiredCapabilities.every((capability) => capabilities.has(capability));
}

function isSelectableRegion(region: RegionDescriptor): boolean {
  const status = region.status;
  return status !== "disabled" && status !== "draining";
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
        consistencyLevel: readReplicaOptions.consistencyLevel,
        routingMode: readReplicaOptions.routingMode,
        preferredRegionId: request.preferredRegionId ?? null,
        ...(readReplicaOptions.bypassCache === undefined ? {} : { bypassCache: readReplicaOptions.bypassCache }),
      });

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
    const inferredPrimaryRegionId = request.primaryRegionId ?? request.regions[0]?.regionId ?? null;
    const unhealthyPrimaryRegionId = !request.primaryRegionHealthy ? inferredPrimaryRegionId : null;
    const allowedJurisdictions = new Set(request.policy.allowedJurisdictions);
    const requiredCapabilities = request.policy.requiredCapabilities ?? [];
    const blockedRegionSet = new Set<string>();
    const blockedRegions = request.regions
      .filter((region) =>
        blockedRegionIds.has(region.regionId)
        || region.regionId === unhealthyPrimaryRegionId
        || !isSelectableRegion(region)
        || !region.residencyAllowed
        || !allowedJurisdictions.has(region.jurisdiction)
        || !includesAllCapabilities(region, requiredCapabilities))
      .map((region) => {
        blockedRegionSet.add(region.regionId);
        return region.regionId;
      });

    const candidateDescriptors = request.regions.filter((region) => !blockedRegions.includes(region.regionId));
    const preferredRegion = request.preferredRegionId == null
      ? null
      : candidateDescriptors.find((region) => region.regionId === request.preferredRegionId) ?? null;
    const selectedRegion = operationType === "write"
      ? this.selectWriteRegion(candidateDescriptors, request)
      : preferredRegion ?? selectPreferredRegion(candidateDescriptors);
    const failoverCandidates = candidateDescriptors
      .filter((region) =>
        region.regionId !== selectedRegion?.regionId
        && region.regionId !== inferredPrimaryRegionId)
      .map((region) => region.regionId);
    const failover = resolveRegionFailover({
      primaryHealthy: request.primaryRegionHealthy,
      currentLeaderRegionId: request.primaryRegionId ?? null,
      partitionKey: request.policy.policyId,
      candidateRegionIds: failoverCandidates,
    });
    const failoverRegionId = this.resolveFailoverRegionId({
      request,
      inferredPrimaryRegionId,
      candidateRegionIds: failoverCandidates,
      preferredFailoverRegionId: failover.targetRegionId ?? null,
      selectedRegionId: selectedRegion?.regionId ?? null,
    });

    const crossBorderClass = request.policy.crossBorderTransferClass ?? (request.policy.allowCrossBorder === false ? "local_only" : "free_transfer");
    const crossBorderTransferChain = this.buildCrossBorderTransferChain(request, selectedRegion);
    const auditTrail = [
      `policy:${request.policy.policyId}`,
      `operation:${operationType}`,
      `cross_border_class:${crossBorderClass}`,
      `blocked:${blockedRegions.join(",") || "none"}`,
      ...(request.preferredRegionId != null && preferredRegion == null && blockedRegionSet.has(request.preferredRegionId)
        ? [`fallback:preferred_region_excluded:${request.preferredRegionId}`]
        : []),
      `failover:${failoverRegionId ?? "none"}`,
      ...(crossBorderTransferChain?.auditTrail ?? []),
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
        primaryRegionId: inferredPrimaryRegionId ?? selectedRegion?.regionId ?? null,
        failoverRegionId,
        replicationTargets: request.replicationPolicy == null
          ? []
          : candidateDescriptors
            .filter((region) => shouldReplicateToRegion(request.replicationPolicy!, region.regionId))
            .map((region) => region.regionId),
      },
      blockedRegions,
      ...(crossBorderTransferChain == null ? {} : { crossBorderTransferChain }),
    };
  }

  private buildCrossBorderTransferChain(
    request: CrossRegionRouteRequest,
    selectedRegion: RegionDescriptor | null,
  ): CrossBorderTransferChain | undefined {
    const sourceRegion = request.primaryRegionId == null
      ? request.regions[0] ?? null
      : request.regions.find((region) => region.regionId === request.primaryRegionId) ?? request.regions[0] ?? null;
    if (sourceRegion == null) {
      return undefined;
    }

    const targetRegion = this.resolveCrossBorderTarget(request, sourceRegion, selectedRegion);
    if (targetRegion == null) {
      return undefined;
    }

    const crossBorderRequired = sourceRegion.jurisdiction !== targetRegion.jurisdiction;
    if (!crossBorderRequired) {
      return undefined;
    }

    const dataCategories = request.policy.dataCategories ?? (request as CrossRegionRouteRequest & { dataCategories?: readonly string[] }).dataCategories ?? ["personal"];
    const containsSensitiveData = dataCategories.some((category) => ["health", "financial", "biometric"].includes(category));
    const impactScore = containsSensitiveData ? 0.9 : 0.7;
    const regulatoryFlags = [
      ...(targetRegion.jurisdiction === "EU" ? ["GDPR_ARTICLE_44"] : []),
      ...(containsSensitiveData ? ["SENSITIVE_DATA_TRANSFER"] : []),
    ];
    const policyAllowsCrossBorder = request.policy.allowCrossBorder ?? request.policy.crossBorderTransferClass !== "local_only";
    const selectedMechanism = !policyAllowsCrossBorder
      ? "local_only"
      : containsSensitiveData
        ? "federated_query"
        : "encrypted_pipeline";
    const violations = policyAllowsCrossBorder ? [] : ["Cross-border transfer not allowed by policy"];
    const auditTrail = [
      `step1_jurisdiction:${sourceRegion.jurisdiction}->${targetRegion.jurisdiction}`,
      `step2_impact:${impactScore}`,
      `step3_mechanism:${selectedMechanism}`,
      `step4_minimization:${selectedMechanism === "federated_query" ? "fully_aggregated" : "pseudonymized"}`,
      `step5_outputscan:${violations.length === 0 ? "passed" : "blocked"}`,
    ];

    return {
      chainStepResults: {
        jurisdictionClassification: {
          sourceJurisdiction: sourceRegion.jurisdiction,
          targetJurisdiction: targetRegion.jurisdiction,
          crossBorderRequired,
        },
        impactAssessment: {
          impactScore,
          dataCategories,
          regulatoryFlags,
        },
        mechanismSelection: {
          selectedMechanism,
          encryptionRequired: selectedMechanism !== "local_only",
          auditLoggingRequired: true,
          allowedByPolicy: policyAllowsCrossBorder,
        },
        dataMinimization: {
          fieldsToRedact: selectedMechanism === "local_only" ? [] : ["email", "phone", "address"],
          aggregationLevel: selectedMechanism === "federated_query" ? "fully_aggregated" : selectedMechanism === "local_only" ? "none" : "pseudonymized",
          minimizationApplied: selectedMechanism !== "local_only",
        },
        outputScan: {
          passed: violations.length === 0,
          violations,
        },
      },
      overallDecision: violations.length === 0 ? "allowed" : "blocked",
      blockedReason: violations[0] ?? null,
      auditTrail,
    };
  }

  private resolveCrossBorderTarget(
    request: CrossRegionRouteRequest,
    sourceRegion: RegionDescriptor,
    selectedRegion: RegionDescriptor | null,
  ): RegionDescriptor | null {
    if (selectedRegion != null && selectedRegion.jurisdiction !== sourceRegion.jurisdiction) {
      return selectedRegion;
    }
    if (request.preferredRegionId != null) {
      const preferred = request.regions.find((region) => region.regionId === request.preferredRegionId) ?? null;
      if (preferred != null && preferred.jurisdiction !== sourceRegion.jurisdiction) {
        return preferred;
      }
    }
    return request.regions.find((region) => region.jurisdiction !== sourceRegion.jurisdiction) ?? null;
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

  private resolveFailoverRegionId(input: {
    request: CrossRegionRouteRequest;
    inferredPrimaryRegionId: string | null;
    candidateRegionIds: readonly string[];
    preferredFailoverRegionId: string | null;
    selectedRegionId: string | null;
  }): string | null {
    if (input.request.primaryRegionHealthy) {
      return null;
    }
    const excluded = new Set<string>([
      ...(input.inferredPrimaryRegionId == null ? [] : [input.inferredPrimaryRegionId]),
      ...(input.request.policy.blockedRegionIds ?? []),
    ]);
    const preferred = input.preferredFailoverRegionId;
    if (preferred != null && input.candidateRegionIds.includes(preferred) && !excluded.has(preferred)) {
      return preferred;
    }
    if (input.selectedRegionId != null && !excluded.has(input.selectedRegionId)) {
      return input.selectedRegionId;
    }
    return input.candidateRegionIds.find((regionId) => !excluded.has(regionId)) ?? null;
  }
}
