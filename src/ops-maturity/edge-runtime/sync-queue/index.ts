export interface EdgeSyncEnvelope {
  readonly envelopeId: string;
  readonly device_id?: string;
  readonly sequence_no?: number;
  readonly priority: number;
  readonly createdAt?: string;
  readonly local_time_offset?: number;
  readonly prev_hash?: string;
  readonly side_effect_dependency_refs?: readonly string[];
  readonly signature?: string;
}

export function orderEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[] {
  return [...items].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    if ((left.sequence_no ?? Number.MAX_SAFE_INTEGER) !== (right.sequence_no ?? Number.MAX_SAFE_INTEGER)) {
      return (left.sequence_no ?? Number.MAX_SAFE_INTEGER) - (right.sequence_no ?? Number.MAX_SAFE_INTEGER);
    }
    return String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? ""));
  });
}

export function dedupeEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[] {
  const latest = new Map<string, EdgeSyncEnvelope>();
  for (const item of items) {
    const existing = latest.get(item.envelopeId);
    if (
      !existing
      || (item.sequence_no ?? Number.MIN_SAFE_INTEGER) > (existing.sequence_no ?? Number.MIN_SAFE_INTEGER)
      || (
        (item.sequence_no ?? Number.MIN_SAFE_INTEGER) === (existing.sequence_no ?? Number.MIN_SAFE_INTEGER)
        && String(item.createdAt ?? "") >= String(existing.createdAt ?? "")
      )
    ) {
      latest.set(item.envelopeId, item);
    }
  }
  return orderEdgeSyncQueue([...latest.values()]);
}

export interface SyncQueueChainValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly topologicalOrder: readonly string[];
}

export function validateSyncQueueChain(items: readonly EdgeSyncEnvelope[]): SyncQueueChainValidationResult {
  if (items.length === 0) {
    return { valid: true, errors: [], topologicalOrder: [] };
  }
  const errors: string[] = [];
  const ordered = orderEdgeSyncQueue(items);
  const byEnvelopeId = new Map(ordered.map((item) => [item.envelopeId, item] as const));
  const dependencyGraph = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (let index = 0; index < ordered.length; index++) {
    const item = ordered[index]!;
    dependencyGraph.set(item.envelopeId, []);
    indegree.set(item.envelopeId, 0);
    if (index === 0 && item.prev_hash != null) {
      errors.push(`first_item_must_have_null_prev_hash:${item.envelopeId}`);
    }
    if (index > 0) {
      const previous = ordered[index - 1]!;
      const expectedPrevHash = `${previous.envelopeId}:${previous.sequence_no ?? ""}:${previous.createdAt ?? ""}`;
      if (item.prev_hash !== expectedPrevHash) {
        errors.push(`prev_hash_mismatch:${item.envelopeId}:expected_${expectedPrevHash}`);
      }
    }
  }

  for (const item of ordered) {
    for (const dependency of item.side_effect_dependency_refs ?? []) {
      if (!byEnvelopeId.has(dependency)) {
        errors.push(`missing_dependency:${item.envelopeId}:${dependency}`);
        continue;
      }
      dependencyGraph.get(dependency)?.push(item.envelopeId);
      indegree.set(item.envelopeId, (indegree.get(item.envelopeId) ?? 0) + 1);
    }
  }

  const queue: string[] = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([envelopeId]) => envelopeId);
  const topologicalOrder: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    topologicalOrder.push(current);
    for (const next of dependencyGraph.get(current) ?? []) {
      const nextInDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextInDegree);
      if (nextInDegree === 0) {
        queue.push(next);
      }
    }
  }

  if (topologicalOrder.length !== ordered.length) {
    errors.push("dependency_cycle_detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    topologicalOrder,
  };
}
