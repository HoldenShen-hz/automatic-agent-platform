import { orderFairQueue } from "./fair-queue/index.js";
import { choosePreemptionVictim } from "./preemption/index.js";
import { isQuotaExceeded } from "./quota-enforcer/index.js";
export class FairSchedulingService {
    schedule(request) {
        const ordered = orderFairQueue(request.queueItems);
        const quotaExceeded = isQuotaExceeded(request.quotaPolicy, request.claim.requestedUnits);
        const starvedItemIds = request.queueItems
            .filter((item) => item.ageMs >= 15 * 60_000)
            .map((item) => item.itemId);
        const victim = quotaExceeded ? choosePreemptionVictim(request.preemptionCandidates) : null;
        return {
            queue: {
                orderedItemIds: ordered.map((item) => item.itemId),
                starvedItemIds,
                quotaExceeded,
            },
            preemption: {
                shouldPreempt: quotaExceeded && victim != null,
                victimExecutionId: victim?.executionId ?? null,
                reason: quotaExceeded
                    ? victim == null
                        ? "resource_manager.quota_exceeded_without_victim"
                        : "resource_manager.quota_exceeded_preempt_low_priority"
                    : null,
            },
        };
    }
}
//# sourceMappingURL=fair-scheduling-service.js.map