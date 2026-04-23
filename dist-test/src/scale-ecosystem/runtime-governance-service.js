import { listEnabledConnectors } from "./integration/connector-registry/index.js";
import { summarizeConnectorHealth } from "./integration/health-monitor/index.js";
import { resolveRegionFailover } from "./multi-region/failover-controller/index.js";
import { selectPreferredRegion } from "./multi-region/region-router/index.js";
import { orderFairQueue } from "./resource-manager/fair-queue/index.js";
import { choosePreemptionVictim } from "./resource-manager/preemption/index.js";
import { isQuotaExceeded } from "./resource-manager/quota-enforcer/index.js";
import { allocateReservedCapacity } from "./sla-engine/resource-allocator/index.js";
import { detectSlaBreach } from "./sla-engine/breach-detector/index.js";
import { resolveHighestPriorityTier } from "./sla-engine/tier-resolver/index.js";
export class RuntimeGovernanceService {
    evaluate(input) {
        const enabledConnectors = listEnabledConnectors(input.connectors)
            .filter((item) => (item.capabilities ?? []).includes(input.capability));
        const connectorHealth = summarizeConnectorHealth(input.connectorHealthReports.filter((item) => enabledConnectors.some((connector) => connector.connectorId === item.connectorId)));
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
//# sourceMappingURL=runtime-governance-service.js.map