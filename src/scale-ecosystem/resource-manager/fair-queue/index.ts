export interface FairQueueItem {
  readonly itemId: string;
  readonly tenantId: string;
  readonly orgId?: string;
  readonly domainId?: string;
  readonly slaTier?: number;
  readonly priority: number;
  readonly ageMs: number;
}

export function orderFairQueue(items: readonly FairQueueItem[]): FairQueueItem[] {
  return [...items].sort((left, right) => {
    const leftScore = (left.slaTier ?? 0) * 1000 + left.priority * 100 + Math.min(99, Math.floor(left.ageMs / 60_000));
    const rightScore = (right.slaTier ?? 0) * 1000 + right.priority * 100 + Math.min(99, Math.floor(right.ageMs / 60_000));
    if ((left.orgId ?? "") !== (right.orgId ?? "")) {
      return (left.orgId ?? "").localeCompare(right.orgId ?? "");
    }
    if ((left.domainId ?? "") !== (right.domainId ?? "")) {
      return (left.domainId ?? "").localeCompare(right.domainId ?? "");
    }
    return rightScore - leftScore;
  });
}
