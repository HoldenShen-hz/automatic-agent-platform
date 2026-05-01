export type HarnessMemoryNamespace = "run" | "domain" | "shared";
export type MemoryTier = "working" | "long_term" | "shared";

export interface HarnessMemoryRecord {
  readonly namespace: HarnessMemoryNamespace;
  readonly scopeId: string;
  readonly key: string;
  readonly value: unknown;
  readonly tier: MemoryTier;
  readonly accessCount: number;
  readonly lastAccessedAt: string;
  readonly createdAt: string;
}

interface InternalMemoryRecord extends HarnessMemoryRecord {
  readonly promotionScore: number;
  readonly demotionScore: number;
}

const SELF_ENHANCEMENT_PATTERNS = [
  "modify_own_prompt",
  "update_own_instructions",
  "change_own_role",
  "escalate_own_permissions",
  "update_policy",
  "modify_constraints",
];

const PROMOTION_THRESHOLD = 10;
const DEMOTION_THRESHOLD = 5;
const TIER_MAX_SIZE: Record<MemoryTier, number> = {
  working: 100,
  long_term: 500,
  shared: 1000,
};

export class HarnessMemoryManager {
  private readonly namespaces = {
    run: new Map<string, Map<string, unknown>>(),
    domain: new Map<string, Map<string, unknown>>(),
    shared: new Map<string, Map<string, unknown>>(),
  } satisfies Record<HarnessMemoryNamespace, Map<string, Map<string, unknown>>>;

  private readonly memoryRecords = new Map<string, InternalMemoryRecord>();

  public write(namespace: HarnessMemoryNamespace, scopeId: string, key: string, value: unknown): void {
    // Anti-self-enhancement check
    if (this.isSelfEnhancementAttempt(key, value)) {
      throw new Error(`harness.memory.self_enhancement_blocked:${key}`);
    }

    const scoped = this.namespaces[namespace].get(scopeId) ?? new Map<string, unknown>();
    const recordKey = `${namespace}:${scopeId}:${key}`;
    const existing = this.memoryRecords.get(recordKey);

    // §174-2035 FIX: Check tier capacity before writing new record.
    // Previously, records were written first then eviction was attempted during
    // promotion. This could cause unbounded growth if records weren't promoted.
    // Now we check capacity and evict oldest if needed BEFORE writing.
    const initialTier = existing?.tier ?? this.inferInitialTier(namespace);
    if (!existing && this.countTierRecords(initialTier) >= TIER_MAX_SIZE[initialTier]) {
      this.evictOldestFromTier(initialTier);
    }

    const record: InternalMemoryRecord = {
      namespace,
      scopeId,
      key,
      value,
      tier: existing?.tier ?? this.inferInitialTier(namespace),
      accessCount: (existing?.accessCount ?? 0) + 1,
      lastAccessedAt: new Date().toISOString(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      promotionScore: existing?.promotionScore ?? 0,
      demotionScore: existing?.demotionScore ?? 0,
    };

    this.memoryRecords.set(recordKey, record);
    scoped.set(key, value);
    this.namespaces[namespace].set(scopeId, scoped);

    // Evaluate promotion/demotion
    this.evaluateTierChanges(recordKey, record);
  }

  public read(namespace: HarnessMemoryNamespace, scopeId: string, key: string): unknown {
    const recordKey = `${namespace}:${scopeId}:${key}`;
    const record = this.memoryRecords.get(recordKey);
    if (record) {
      // Update access metadata
      this.memoryRecords.set(recordKey, {
        ...record,
        accessCount: record.accessCount + 1,
        lastAccessedAt: new Date().toISOString(),
      });
    }
    return this.namespaces[namespace].get(scopeId)?.get(key) ?? null;
  }

  public list(namespace: HarnessMemoryNamespace, scopeId: string): readonly HarnessMemoryRecord[] {
    const scoped = this.namespaces[namespace].get(scopeId);
    if (!scoped) {
      return [];
    }
    return [...scoped.entries()].map(([key, value]) => {
      const recordKey = `${namespace}:${scopeId}:${key}`;
      const record = this.memoryRecords.get(recordKey);
      return {
        namespace,
        scopeId,
        key,
        value,
        tier: record?.tier ?? this.inferInitialTier(namespace),
        accessCount: record?.accessCount ?? 0,
        lastAccessedAt: record?.lastAccessedAt ?? new Date().toISOString(),
        createdAt: record?.createdAt ?? new Date().toISOString(),
      };
    });
  }

  public getTier(namespace: HarnessMemoryNamespace, scopeId: string, key: string): MemoryTier | null {
    const recordKey = `${namespace}:${scopeId}:${key}`;
    const record = this.memoryRecords.get(recordKey);
    return record?.tier ?? null;
  }

  private inferInitialTier(namespace: HarnessMemoryNamespace): MemoryTier {
    switch (namespace) {
      case "run":
        return "working";
      case "domain":
        return "long_term";
      case "shared":
        return "shared";
    }
  }

  private isSelfEnhancementAttempt(key: string, value: unknown): boolean {
    if (SELF_ENHANCEMENT_PATTERNS.some((pattern) => key.toLowerCase().includes(pattern))) {
      return true;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (record["type"] === "self_modification" || record["action"] === "self_enhance") {
        return true;
      }
    }
    return false;
  }

  private evaluateTierChanges(recordKey: string, record: InternalMemoryRecord): void {
    // Increment promotion score on access
    const updatedRecord = {
      ...record,
      promotionScore: record.promotionScore + 1,
      demotionScore: Math.max(0, record.demotionScore - 1),
    };

    // Check promotion
    if (updatedRecord.promotionScore >= PROMOTION_THRESHOLD) {
      this.promote(recordKey, updatedRecord);
      return;
    }

    // Check demotion (for working tier only, and if not accessed recently)
    if (record.tier === "working") {
      const lastAccessAge = Date.now() - new Date(record.lastAccessedAt).getTime();
      if (lastAccessAge > 30 * 60 * 1000 && updatedRecord.demotionScore >= DEMOTION_THRESHOLD) {
        this.demote(recordKey, updatedRecord);
        return;
      }
    }

    this.memoryRecords.set(recordKey, updatedRecord);
  }

  private promote(recordKey: string, record: InternalMemoryRecord): void {
    let newTier: MemoryTier;
    switch (record.tier) {
      case "working":
        newTier = "long_term";
        break;
      case "long_term":
        newTier = "shared";
        break;
      default:
        // Already at max tier
        this.memoryRecords.set(recordKey, { ...record, promotionScore: 0 });
        return;
    }

    // Check tier capacity
    if (this.countTierRecords(newTier) >= TIER_MAX_SIZE[newTier]) {
      // Evict oldest from target tier
      this.evictOldestFromTier(newTier);
    }

    this.memoryRecords.set(recordKey, {
      ...record,
      tier: newTier,
      promotionScore: 0,
    });
  }

  private demote(recordKey: string, record: InternalMemoryRecord): void {
    let newTier: MemoryTier;
    switch (record.tier) {
      case "shared":
        newTier = "long_term";
        break;
      case "long_term":
        newTier = "working";
        break;
      default:
        // Already at min tier
        this.memoryRecords.set(recordKey, { ...record, demotionScore: 0 });
        return;
    }

    this.memoryRecords.set(recordKey, {
      ...record,
      tier: newTier,
      demotionScore: 0,
    });
  }

  private evictOldestFromTier(tier: MemoryTier): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, record] of this.memoryRecords.entries()) {
      if (record.tier === tier) {
        const accessTime = new Date(record.lastAccessedAt).getTime();
        if (accessTime < oldestTime) {
          oldestTime = accessTime;
          oldestKey = key;
        }
      }
    }

    if (oldestKey) {
      this.memoryRecords.delete(oldestKey);
    }
  }

  private countTierRecords(tier: MemoryTier): number {
    let count = 0;
    for (const record of this.memoryRecords.values()) {
      if (record.tier === tier) {
        count++;
      }
    }
    return count;
  }
}
