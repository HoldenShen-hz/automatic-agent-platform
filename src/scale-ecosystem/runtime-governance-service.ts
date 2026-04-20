import { listEnabledConnectors, type ConnectorManifest } from "./integration/connector-registry/index.js";
import { summarizeConnectorHealth, type ConnectorHealthReport } from "./integration/health-monitor/index.js";
import { resolveRegionFailover } from "./multi-region/failover-controller/index.js";
import { selectPreferredRegion, type RegionDescriptor } from "./multi-region/region-router/index.js";
import { orderFairQueue, type FairQueueItem } from "./resource-manager/fair-queue/index.js";
import { choosePreemptionVictim, type PreemptionCandidate } from "./resource-manager/preemption/index.js";
import { isQuotaExceeded, type QuotaPolicy } from "./resource-manager/quota-enforcer/index.js";
import { allocateReservedCapacity, type ReservedCapacityAllocation } from "./sla-engine/resource-allocator/index.js";
import { detectSlaBreach, type SlaCommitment, type SlaObservation } from "./sla-engine/breach-detector/index.js";
import { resolveHighestPriorityTier, type SlaTier } from "./sla-engine/tier-resolver/index.js";

export interface RuntimeGovernanceRequest {
  readonly capability: string;
  readonly connectors: readonly ConnectorManifest[];
  readonly connectorHealthReports: readonly ConnectorHealthReport[];
  readonly regions: readonly RegionDescriptor[];
  readonly primaryRegionHealthy: boolean;
  readonly quotaPolicy: QuotaPolicy;
  readonly requestedUnits: number;
  readonly queueItems: readonly FairQueueItem[];
  readonly preemptionCandidates: readonly PreemptionCandidate[];
  readonly tiers: readonly SlaTier[];
  readonly reservedCapacityPlan: readonly ReservedCapacityAllocation[];
  readonly totalCapacityUnits: number;
  readonly observation: SlaObservation;
  readonly commitment: SlaCommitment;
}

export interface RuntimeGovernanceDecision {
  readonly connectorId: string | null;
  readonly regionId: string | null;
  readonly failoverRegionId: string | null;
  readonly quotaAllowed: boolean;
  readonly queueOrder: readonly string[];
  readonly preemptionVictimId: string | null;
  readonly highestTierId: string | null;
  readonly reservedCapacity: Readonly<Record<string, number>>;
  readonly breaches: readonly string[];
}

export class RuntimeGovernanceService {
  public evaluate(input: RuntimeGovernanceRequest): RuntimeGovernanceDecision {
    const enabledConnectors = listEnabledConnectors(input.connectors)
      .filter((item) => (item.capabilities ?? []).includes(input.capability));
    const connectorHealth = summarizeConnectorHealth(
      input.connectorHealthReports.filter((item) => enabledConnectors.some((connector) => connector.connectorId === item.connectorId)),
    );
    const preferredRegion = selectPreferredRegion(input.regions);
    const failover = resolveRegionFailover({
      primaryHealthy: input.primaryRegionHealthy,
      candidateRegionIds: input.regions
        .filter((item) => item.residencyAllowed && (preferredRegion == null || item.regionId !== preferredRegion.regionId))
        .map((item) => item.regionId),
    });
    const queueOrder = orderFairQueue(input.queueItems).map((item) => item.itemId);
    const preemptionVictimId = choosePreemptionVictim(input.preemptionCandidates)?.executionId ?? null;
    const highestTierId = resolveHighestPriorityTier(input.tiers)?.tierId ?? null;

    return {
      connectorId: connectorHealth === "failed" ? null : enabledConnectors[0]?.connectorId ?? null,
      regionId: preferredRegion?.regionId ?? null,
      failoverRegionId: failover.targetRegionId,
      quotaAllowed: !isQuotaExceeded(input.quotaPolicy, input.requestedUnits),
      queueOrder,
      preemptionVictimId,
      highestTierId,
      reservedCapacity: allocateReservedCapacity(input.totalCapacityUnits, input.reservedCapacityPlan),
      breaches: detectSlaBreach(input.observation, input.commitment),
    };
  }
}
