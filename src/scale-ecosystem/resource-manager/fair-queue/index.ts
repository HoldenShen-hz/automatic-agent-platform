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
    const leftGuaranteed = left.guaranteedQuotaShare ?? 0;
    const rightGuaranteed = right.guaranteedQuotaShare ?? 0;
    if (leftGuaranteed !== rightGuaranteed) {
      return rightGuaranteed - leftGuaranteed;
    }

    return left.itemId.localeCompare(right.itemId);
  });
}

function computeFairShareScore(item: FairQueueItem): number {
  const priorityScore = Math.min(100, Math.max(0, item.priority)) * 100;
  const ageBonus = Math.min(99, Math.floor(item.ageMs / 60_000));
  const borrowedScore = (item.borrowedCredits ?? 0) * 10;
  const reclaimBonus = Math.max(0, item.reclaimedCredits ?? 0);
  return (item.slaTier ?? 0) * 10_000
    + priorityScore
    + borrowedScore
    + reclaimBonus * 10
    + ageBonus;
}
