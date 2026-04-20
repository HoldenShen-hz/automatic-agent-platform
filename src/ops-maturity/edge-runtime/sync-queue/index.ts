export interface EdgeSyncEnvelope {
  readonly envelopeId: string;
  readonly priority: number;
}

export function orderEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[] {
  return [...items].sort((left, right) => right.priority - left.priority);
}
