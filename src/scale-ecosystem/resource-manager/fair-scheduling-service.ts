import { orderFairQueue, type FairQueueItem } from "./fair-queue/index.js";
import { choosePreemptionVictim, type PreemptionCandidate } from "./preemption/index.js";
import { evaluateMultiDimensionalQuota, type MultiResourceQuotaVector } from "./quota-enforcer/index.js";

export interface SchedulingClass {
  readonly tenantId: string;
  readonly orgNodeId?: string | null;
  readonly domainId: string;
  readonly slaTierId: string;
  readonly priority: number;
}

export interface ResourceClaim {
  readonly claimId: string;
  readonly schedulingClass: SchedulingClass;
  readonly requestedUnits: number;
}

export interface PreemptionDecision {
  readonly shouldPreempt: boolean;
  readonly victimExecutionId: string | null;
  readonly reason: string | null;
}

export interface FairQueueSnapshot {
  readonly orderedItemIds: readonly string[];
  readonly starvedItemIds: readonly string[];
  readonly quotaExceeded: boolean;
}

export interface FairSchedulingRequest {
  readonly quotaPolicy: MultiResourceQuotaVector;
  readonly claim: ResourceClaim;
  readonly queueItems: readonly FairQueueItem[];
  readonly preemptionCandidates: readonly PreemptionCandidate[];
}

export interface FairSchedulingDecision {
  readonly queue: FairQueueSnapshot;
  readonly preemption: PreemptionDecision;
}

export class FairSchedulingService {
  public schedule(request: FairSchedulingRequest): FairSchedulingDecision {
    const ordered = orderFairQueue(request.queueItems);
    // Evaluate quota using hardLimit as the rejection threshold (not burstLimit)
    const quotaDecision = evaluateMultiDimensionalQuota(request.quotaPolicy, {
      workerUnits: request.claim.requestedUnits,
    });
    const quotaExceeded = quotaDecision.exceeded;
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
