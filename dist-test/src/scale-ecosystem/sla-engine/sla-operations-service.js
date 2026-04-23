import { detectSlaBreach } from "./breach-detector/index.js";
import { allocateReservedCapacity } from "./resource-allocator/index.js";
import { resolveHighestPriorityTier } from "./tier-resolver/index.js";
export class SlaOperationsService {
    evaluate(request) {
        const selectedTier = request.selectedTierId == null
            ? resolveHighestPriorityTier(request.tiers)
            : request.tiers.find((tier) => tier.tierId === request.selectedTierId) ?? null;
        const reservedCapacity = allocateReservedCapacity(request.totalCapacityUnits, request.reservedCapacityPlan ?? request.tiers.map((tier) => ({
            tierId: tier.tierId,
            reservedPercent: tier.reservedCapacityPercent ?? 0,
        })));
        if (selectedTier == null) {
            return {
                selectedTierId: null,
                routingHint: null,
                reservedCapacity,
                breachRecords: [],
                escalationActions: [],
                penaltyDecisions: [],
            };
        }
        const commitment = {
            maxLatencyMs: selectedTier.targetLatencyMs ?? 1000,
            minSuccessRate: selectedTier.targetSuccessRate ?? 0.99,
            maxQueueWaitMs: selectedTier.maxQueueWaitMs ?? 3000,
        };
        const breachCodes = detectSlaBreach(request.observation, commitment);
        const breachRecords = breachCodes.length === 0
            ? []
            : [{
                    tierId: selectedTier.tierId,
                    breachCodes,
                    observedAt: request.observedAt,
                    severity: (breachCodes.includes("sla.success_rate_breach") ? "critical" : "warning"),
                }];
        const escalationActions = breachRecords.map((record) => ({
            tierId: record.tierId,
            action: (record.severity === "critical" ? "page_sre" : "notify_owner"),
            reason: record.breachCodes.join(","),
        }));
        const penaltyDecisions = breachRecords.map((record) => ({
            tierId: record.tierId,
            penaltyType: (record.severity === "critical" ? "contract_review" : "credit"),
            severity: record.severity,
        }));
        return {
            selectedTierId: selectedTier.tierId,
            routingHint: {
                tierId: selectedTier.tierId,
                preemptionPriority: selectedTier.preemptionPriority ?? 0,
                reservedCapacityUnits: reservedCapacity[selectedTier.tierId] ?? 0,
                maxQueueWaitMs: selectedTier.maxQueueWaitMs ?? 3000,
            },
            reservedCapacity,
            breachRecords,
            escalationActions,
            penaltyDecisions,
        };
    }
}
//# sourceMappingURL=sla-operations-service.js.map