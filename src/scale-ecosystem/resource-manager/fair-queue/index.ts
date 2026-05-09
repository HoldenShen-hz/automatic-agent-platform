export interface FairQueueItem {
  readonly itemId: string;
  readonly tenantId: string;
  readonly orgId?: string;
  readonly domainId?: string;
  readonly slaTier?: number;
  readonly priority: number;
  readonly ageMs: number;
  readonly guaranteedQuotaShare?: number;
  readonly borrowedCredits?: number;
  readonly reclaimedCredits?: number;
}

export function orderFairQueue(items: readonly FairQueueItem[]): FairQueueItem[] {
  return [...items].sort((left, right) => {
    const leftScore = computeFairShareScore(left);
    const rightScore = computeFairShareScore(right);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if ((left.orgId ?? "") !== (right.orgId ?? "")) {
      return (left.orgId ?? "").localeCompare(right.orgId ?? "");
    }
    if ((left.domainId ?? "") !== (right.domainId ?? "")) {
      return (left.domainId ?? "").localeCompare(right.domainId ?? "");
    }
    return left.itemId.localeCompare(right.itemId);
  });
}

function computeFairShareScore(item: FairQueueItem): number {
  const guaranteedShare = item.guaranteedQuotaShare ?? 1;
  const ageScore = Math.min(99, Math.floor(item.ageMs / 60_000));
  const borrowPenalty = Math.max(0, item.borrowedCredits ?? 0);
  const reclaimBonus = Math.max(0, item.reclaimedCredits ?? 0);
  return (item.slaTier ?? 0) * 10_000
    + guaranteedShare * 1_000
    + item.priority * 100
    + ageScore
    + reclaimBonus * 10
    - borrowPenalty * 10;
}
