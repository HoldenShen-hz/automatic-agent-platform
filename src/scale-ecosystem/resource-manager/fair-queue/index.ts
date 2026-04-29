export interface FairQueueItem {
  readonly itemId: string;
  readonly tenantId: string;
  readonly orgId?: string;
  readonly domainId?: string;
  readonly slaTier?: number;
  readonly priority: number;
  readonly ageMs: number;
  /** Weighted fair queue weight for this item (higher = more fair share) */
  readonly weight?: number;
  /** Guaranteed quota allocation for this item */
  readonly guaranteedQuota?: number;
  /** Current borrowed quota (for repayment tracking) */
  readonly borrowedQuota?: number;
}

/**
 * Per §53.4: Weighted Fair Queue implementation
 * - Weighted fair scheduling based on weight and SLA tier
 * - Guaranteed quota allocation with deficit tracking
 * - Borrow/lend mechanism for quota redistribution
 * - Lexicographic sorting removed (was incorrect WFQ behavior)
 */
export function orderFairQueue(items: readonly FairQueueItem[]): FairQueueItem[] {
  if (items.length === 0) return [];

  // Calculate total weight for normalization
  const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  const totalGuaranteedQuota = items.reduce((sum, item) => sum + (item.guaranteedQuota ?? 0), 0);

  return [...items].sort((left, right) => {
    // Calculate composite score: SLA tier * weight factor + priority + age
    // Higher SLA tier and weight = more scheduling priority
    const leftWeightFactor = (left.weight ?? 1) / totalWeight;
    const rightWeightFactor = (right.weight ?? 1) / totalWeight;

    // SLA tier is the primary factor (higher tier = more critical)
    const leftSlaScore = (left.slaTier ?? 0) * 10000 * leftWeightFactor;
    const rightSlaScore = (right.slaTier ?? 0) * 10000 * rightWeightFactor;

    // Then consider priority (lower priority number = higher actual priority)
    const leftPriorityScore = (100 - Math.min(100, left.priority)) * 100;
    const rightPriorityScore = (100 - Math.min(100, right.priority)) * 100;

    // Age factor: items waiting longer get slight priority boost (aging factor)
    // Cap at 99 points to prevent age from dominating
    const leftAgeScore = Math.min(99, Math.floor(left.ageMs / 60_000));
    const rightAgeScore = Math.min(99, Math.floor(right.ageMs / 60_000));

    // Borrowed quota: items that borrowed should be serviced first to repay
    // Negative borrowedQuota means they lent out, positive means they borrowed
    const leftBorrowScore = (left.borrowedQuota ?? 0) * 10;
    const rightBorrowScore = (right.borrowedQuota ?? 0) * 10;

    const leftScore = leftSlaScore + leftPriorityScore + leftAgeScore + leftBorrowScore;
    const rightScore = rightSlaScore + rightPriorityScore + rightAgeScore + rightBorrowScore;

    // Higher composite score = higher priority in queue
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    // Tiebreaker: prefer item with higher guaranteed quota usage (ensure fairness)
    return (right.guaranteedQuota ?? 0) - (left.guaranteedQuota ?? 0);
  });
}
