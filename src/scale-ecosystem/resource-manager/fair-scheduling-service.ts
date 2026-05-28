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
  readonly reasonCodes: readonly string[];
}

export interface PromotionBudgetPolicy {
  readonly tenantId: string;
  readonly maxPromotionsPerHour: number;
  readonly maxPromotionsPerDay: number;
  readonly usedPromotionsThisHour: number;
  readonly usedPromotionsToday: number;
}

export interface PromotionBudgetDecision {
  readonly allowed: boolean;
  readonly remainingHourlyPromotions: number;
  readonly remainingDailyPromotions: number;
  readonly reason: string | null;
}

export interface FairSchedulingRequest {
  readonly quotaPolicy: MultiResourceQuotaVector;
  readonly claim: ResourceClaim;
  readonly queueItems: readonly FairQueueItem[];
  readonly preemptionCandidates: readonly PreemptionCandidate[];
  readonly promotionBudget?: PromotionBudgetPolicy | null;
  readonly activeLeaseLookup?: ((executionId: string) => boolean) | null;
  readonly quorumRegionCount?: number | null;
  readonly acknowledgedRegionCount?: number | null;
}

export interface FairSchedulingDecision {
  readonly queue: FairQueueSnapshot;
  readonly preemption: PreemptionDecision;
  readonly promotionBudget: PromotionBudgetDecision;
}

export interface FairSchedulingServiceOptions {
  readonly starvationThresholdMs?: number;
}

export class FairSchedulingService {
  private readonly starvationThresholdMs: number;

  public constructor(options: FairSchedulingServiceOptions = {}) {
    this.starvationThresholdMs = options.starvationThresholdMs ?? 15 * 60_000;
  }

  public schedule(request: FairSchedulingRequest): FairSchedulingDecision {
    const ordered = orderFairQueue(request.queueItems);
    const quotaDecision = this.evaluateQuotaDecision(request);
    const quotaExceeded = !quotaDecision.passed;
    const starvedItemIds = request.queueItems
      .filter((item) => item.ageMs >= this.starvationThresholdMs)
      .map((item) => item.itemId);
    const promotionBudget = this.evaluatePromotionBudget(
      request.claim.schedulingClass.tenantId,
      request.promotionBudget ?? null,
    );
    const eligiblePreemptionCandidates = this.filterPreemptableCandidates(request);
    const victim = quotaExceeded && promotionBudget.allowed
      ? choosePreemptionVictim(eligiblePreemptionCandidates)
      : null;

    return {
      queue: {
        orderedItemIds: ordered.map((item) => item.itemId),
        starvedItemIds,
        quotaExceeded,
        reasonCodes: quotaDecision.reasonCodes,
      },
      preemption: {
        shouldPreempt: quotaExceeded && promotionBudget.allowed && victim != null,
        victimExecutionId: victim?.executionId ?? null,
        reason: !promotionBudget.allowed
          ? promotionBudget.reason
          : quotaExceeded
            ? victim == null
              ? "resource_manager.quota_exceeded_without_victim"
              : "resource_manager.quota_exceeded_preempt_low_priority"
            : null,
      },
      promotionBudget,
    };
  }

  private evaluateQuotaDecision(request: FairSchedulingRequest): {
    passed: boolean;
    reasonCodes: readonly string[];
  } {
    const requestedUnits = {
      workerUnits: request.claim.requestedUnits,
    };
    // Evaluate quota using hardLimit as the rejection threshold (not burstLimit)
    const strictDecision = evaluateMultiDimensionalQuota(request.quotaPolicy, requestedUnits);
    const quorumRegionCount = Math.max(0, request.quorumRegionCount ?? 0);
    const acknowledgedRegionCount = Math.max(0, request.acknowledgedRegionCount ?? 0);
    if (!strictDecision.passed && quorumRegionCount > 0 && acknowledgedRegionCount < quorumRegionCount) {
      return {
        passed: false,
        reasonCodes: ["resource_manager.quota_exceeded", "resource_manager.quota_quorum_degraded"],
      };
    }
    return {
      passed: strictDecision.passed,
      reasonCodes: strictDecision.passed ? [] : ["resource_manager.quota_exceeded"],
    };
  }

  private filterPreemptableCandidates(request: FairSchedulingRequest): readonly PreemptionCandidate[] {
    const lookup = request.activeLeaseLookup ?? null;
    if (lookup == null) {
      return request.preemptionCandidates;
    }
    return request.preemptionCandidates.filter((candidate) => !lookup(candidate.executionId));
  }

  private evaluatePromotionBudget(
    tenantId: string,
    budget: PromotionBudgetPolicy | null,
  ): PromotionBudgetDecision {
    if (budget == null) {
      return {
        allowed: true,
        remainingHourlyPromotions: Number.POSITIVE_INFINITY,
        remainingDailyPromotions: Number.POSITIVE_INFINITY,
        reason: null,
      };
    }
    if (budget.tenantId !== tenantId) {
      return {
        allowed: false,
        remainingHourlyPromotions: 0,
        remainingDailyPromotions: 0,
        reason: "resource_manager.promotion_budget_tenant_mismatch",
      };
    }

    const remainingHourlyPromotions = Math.max(0, budget.maxPromotionsPerHour - budget.usedPromotionsThisHour);
    const remainingDailyPromotions = Math.max(0, budget.maxPromotionsPerDay - budget.usedPromotionsToday);
    const allowed = remainingHourlyPromotions > 0 && remainingDailyPromotions > 0;
    return {
      allowed,
      remainingHourlyPromotions,
      remainingDailyPromotions,
      reason: allowed ? null : "resource_manager.promotion_budget_exhausted",
    };
  }
}
