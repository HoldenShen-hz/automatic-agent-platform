import { orderFairQueue, type FairQueueItem } from "./fair-queue/index.js";
import { choosePreemptionVictim, type PreemptionCandidate } from "./preemption/index.js";
import { isQuotaExceeded, type QuotaPolicy } from "./quota-enforcer/index.js";

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
  /** R15-68: Whether promotion was rejected due to promotion budget exhaustion */
  readonly promotionRejected: boolean;
}

export interface FairSchedulingRequest {
  readonly quotaPolicy: QuotaPolicy;
  readonly claim: ResourceClaim;
  readonly queueItems: readonly FairQueueItem[];
  readonly preemptionCandidates: readonly PreemptionCandidate[];
  /** R15-68: Requested promotion budget units (when promoting from queue to active) */
  readonly requestedPromotionBudget?: number;
}

export interface FairSchedulingDecision {
  readonly queue: FairQueueSnapshot;
  readonly preemption: PreemptionDecision;
}

/**
 * R15-68: Tracks used promotion budget per tenant/worker for fair scheduling.
 * Limits how many tasks can be promoted from queue to active execution.
 */
interface PromotionBudgetState {
  readonly tenantId: string;
  readonly workerId: string | null;
  readonly usedBudget: number;
}

export class FairSchedulingService {
  // R15-68: Track used promotion budget per tenant (and optionally per worker)
  private readonly usedPromotionBudget = new Map<string, PromotionBudgetState>();

  /**
   * R15-68: Get the current used promotion budget for a tenant/worker.
   */
  public getUsedPromotionBudget(tenantId: string, workerId?: string | null): number {
    const key = this.buildPromotionBudgetKey(tenantId, workerId);
    return this.usedPromotionBudget.get(key)?.usedBudget ?? 0;
  }

  /**
   * R15-68: Reset the used promotion budget for a tenant/worker.
   * Called when a promotion budget window resets (e.g., hourly).
   */
  public resetPromotionBudget(tenantId: string, workerId?: string | null): void {
    const key = this.buildPromotionBudgetKey(tenantId, workerId);
    this.usedPromotionBudget.delete(key);
  }

  /**
   * R15-68: Check if promotion is allowed based on promotion budget.
   * Returns true if promotion would exceed the promotion budget limit.
   */
  public isPromotionBudgetExceeded(
    tenantId: string,
    requestedPromotionBudget: number,
    promotionBudgetLimit: number,
    workerId?: string | null,
  ): boolean {
    const currentUsed = this.getUsedPromotionBudget(tenantId, workerId);
    return currentUsed + requestedPromotionBudget > promotionBudgetLimit;
  }

  public schedule(request: FairSchedulingRequest): FairSchedulingDecision {
    const ordered = orderFairQueue(request.queueItems);
    const quotaExceeded = isQuotaExceeded(request.quotaPolicy, request.claim.requestedUnits);
    const starvedItemIds = request.queueItems
      .filter((item) => item.ageMs >= 15 * 60_000)
      .map((item) => item.itemId);
    const victim = quotaExceeded ? choosePreemptionVictim(request.preemptionCandidates) : null;

    // R15-68: Check promotion budget before allowing promotion
    let promotionRejected = false;
    const requestedPromotionBudget = request.requestedPromotionBudget ?? 0;
    if (requestedPromotionBudget > 0) {
      const multiResourceQuota = request.quotaPolicy.multiResourceQuota;
      const promotionBudgetLimit = multiResourceQuota?.promotion_budget ?? 0;
      if (promotionBudgetLimit > 0) {
        promotionRejected = this.isPromotionBudgetExceeded(
          request.claim.schedulingClass.tenantId,
          requestedPromotionBudget,
          promotionBudgetLimit,
          null, // worker-level tracking can be added if needed
        );
      }
    }

    return {
      queue: {
        orderedItemIds: ordered.map((item) => item.itemId),
        starvedItemIds,
        quotaExceeded,
        promotionRejected,
      },
      preemption: {
        shouldPreempt: quotaExceeded && victim != null,
        victimExecutionId: victim?.victim?.executionId ?? null,
        reason: quotaExceeded
          ? victim == null
            ? "resource_manager.quota_exceeded_without_victim"
            : "resource_manager.quota_exceeded_preempt_low_priority"
          : null,
      },
    };
  }

  private buildPromotionBudgetKey(tenantId: string, workerId: string | null | undefined): string {
    return workerId ? `${tenantId}:${workerId}` : tenantId;
  }
}
