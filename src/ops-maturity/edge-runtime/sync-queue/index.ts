export interface EdgeSyncEnvelope {
  readonly envelopeId: string;
  readonly priority: number;
  readonly createdAt?: string;
}

export function orderEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[] {
  return [...items].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    return String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? ""));
  });
}

export function dedupeEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[] {
  const latest = new Map<string, EdgeSyncEnvelope>();
  for (const item of items) {
    latest.set(item.envelopeId, item);
  }
  return orderEdgeSyncQueue([...latest.values()]);
}
