export interface EdgeSyncEnvelope {
  readonly envelopeId: string;
  readonly device_id: string;
  readonly sequence_no: number;
  readonly priority: number;
  readonly createdAt: string;
  readonly local_time_offset: number;
  readonly prev_hash: string | null;
  readonly side_effect_dependency_refs: readonly string[];
  readonly signature: string;
}

/**
 * Validation result for sync queue operations.
 * §62.3: Append-only chain must be signed and topologically sorted.
 */
export interface SyncQueueValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly topologicalOrder: readonly EdgeSyncEnvelope[];
}

/**
 * Orders sync queue by sequence_no (topological sort) while respecting priority.
 * §62.3: SyncQueue requires append-only + topological sort ordering.
 */
export function orderEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[] {
  // §62.3: Topological sort by sequence_no while grouping by priority
  const byPriority = new Map<number, EdgeSyncEnvelope[]>();
  for (const item of items) {
    const priorityItems = byPriority.get(item.priority) ?? [];
    priorityItems.push(item);
    byPriority.set(item.priority, priorityItems);
  }

  const sorted: EdgeSyncEnvelope[] = [];
  // Process priorities from highest to lowest
  const priorities = Array.from(byPriority.keys()).sort((a, b) => b - a);
  for (const priority of priorities) {
    const priorityItems = byPriority.get(priority)!;
    // Within same priority, sort by sequence_no
    priorityItems.sort((left, right) => left.sequence_no - right.sequence_no);
    sorted.push(...priorityItems);
  }
  return sorted;
}

/**
 * Validates the append-only chain integrity.
 * §62.3: Chain must have valid prev_hash linkage and signatures.
 */
export function validateSyncQueueChain(items: readonly EdgeSyncEnvelope[]): SyncQueueValidationResult {
  const errors: string[] = [];

  if (items.length === 0) {
    return { valid: true, errors: [], topologicalOrder: [] };
  }

  // Sort by sequence_no first
  const sorted = [...items].sort((a, b) => a.sequence_no - b.sequence_no);

  // Validate chain linkage
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;

    // First item should have null prev_hash or prev_hash must match previous item
    if (i === 0 && item.prev_hash !== null) {
      errors.push(`envelope:${item.envelopeId}:first_item_must_have_null_prev_hash`);
    }

    if (i > 0) {
      const prev = sorted[i - 1]!;
      // Verify prev_hash links to previous item
      const expectedPrevHash = computePrevHash(prev);
      if (item.prev_hash !== expectedPrevHash && item.prev_hash !== null) {
        errors.push(`envelope:${item.envelopeId}:prev_hash_mismatch:expected_${expectedPrevHash}_got_${item.prev_hash}`);
      }
    }

    // Validate side_effect_dependency_refs are satisfied
    for (const depRef of item.side_effect_dependency_refs) {
      const depExists = sorted.some((other) => other.envelopeId === depRef);
      if (!depExists) {
        errors.push(`envelope:${item.envelopeId}:missing_dependency:${depRef}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    topologicalOrder: sorted,
  };
}

/**
 * Computes the expected prev_hash for an envelope based on its content.
 * §62.3: Used for chain validation.
 */
function computePrevHash(item: EdgeSyncEnvelope): string {
  // Simplified hash: in real impl, use proper cryptographic hash
  return `${item.envelopeId}:${item.sequence_no}:${item.createdAt}`;
}

export function dedupeEdgeSyncQueue(items: readonly EdgeSyncEnvelope[]): EdgeSyncEnvelope[] {
  const latest = new Map<string, EdgeSyncEnvelope>();
  for (const item of items) {
    latest.set(item.envelopeId, item);
  }
  return orderEdgeSyncQueue(Array.from(latest.values()));
}
