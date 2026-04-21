import { type FairQueueItem } from "./fair-queue/index.js";
import { type PreemptionCandidate } from "./preemption/index.js";
import { type QuotaPolicy } from "./quota-enforcer/index.js";
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
    readonly quotaPolicy: QuotaPolicy;
    readonly claim: ResourceClaim;
    readonly queueItems: readonly FairQueueItem[];
    readonly preemptionCandidates: readonly PreemptionCandidate[];
}
export interface FairSchedulingDecision {
    readonly queue: FairQueueSnapshot;
    readonly preemption: PreemptionDecision;
}
export declare class FairSchedulingService {
    schedule(request: FairSchedulingRequest): FairSchedulingDecision;
}
