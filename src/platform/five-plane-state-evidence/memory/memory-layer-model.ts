import type { MemoryRecord } from "../../contracts/types/domain.js";

/**
 * §29 Architecture: Memory Layer model with TTL and Eviction Policies.
 *
 * The platform uses a 6-layer memory hierarchy per §29.2:
 * - working  (runtime/task_runtime): short-term, highest frequency, LRU eviction
 * - session  (session): single conversation context, LRU + staleness eviction
 * - episodic (agent): experience chunks, quality-based eviction
 * - semantic (project): shared facts, trust-based eviction
 * - procedural (user): skills/procedures, usage-based eviction
 * - meta     (evolution): performance metrics, importance-based eviction
 *
 * Internal type uses legacy names (runtime/session/agent/project/user/evolution)
 * for backward compatibility. The architecture layer mapping is in DEFAULT_LAYER_TTL_CONFIGS.
 */
export type HierarchicalMemoryLayer =
  | "runtime"
  | "session"
  | "agent"
  | "project"
  | "user"
  | "evolution";

/**
 * Legacy type alias for backward compatibility.
 * @deprecated Use HierarchicalMemoryLayer instead
 */
export type LegacyMemoryLayer = HierarchicalMemoryLayer;

/**
 * §29.2: ContextTruncationReport - Required when memory is evicted.
 * "Facts cannot be silently discarded, compression requires loss report"
 */
export interface ContextTruncationReport {
  readonly layer: HierarchicalMemoryLayer;
  readonly evictedRecords: readonly EvictedMemoryRecord[];
  readonly totalEvicted: number;
  readonly evictedSizeBytes: number;
  readonly reason: EvictionReason;
  readonly timestamp: string;
}

export interface EvictedMemoryRecord {
  readonly recordId: string;
  readonly scope: string;
  readonly key: string;
  readonly createdAt: string;
  readonly lastAccessedAt: string | null;
  readonly ttlMs: number;
  readonly priority: number;
  readonly qualityScore: number | null;
  readonly importanceScore: number | null;
}

export type EvictionReason =
  | "lru_eviction"
  | "stale_expired"
  | "size_limit_exceeded"
  | "manual_truncation"
  | "quality_below_threshold"
  | "trust_below_threshold";

export interface LayerPromotionRule {
  from: HierarchicalMemoryLayer;
  to: HierarchicalMemoryLayer;
  minHitCount: number;
  minQualityScore: number;
  minImportanceScore: number;
}

export interface MemoryPromotionCandidate {
  memory: MemoryRecord;
  currentLayer: HierarchicalMemoryLayer;
  targetLayer: HierarchicalMemoryLayer | null;
  satisfiedRule: LayerPromotionRule | null;
}

export const DEFAULT_MEMORY_PROMOTION_RULES: readonly LayerPromotionRule[] = [
  // R16-38 FIX: Added runtime→session promotion rule
  // Working memory promotes to session after sufficient hits and quality
  { from: "runtime", to: "session", minHitCount: 2, minQualityScore: 0.5, minImportanceScore: 0.4 },
  { from: "session", to: "agent", minHitCount: 3, minQualityScore: 0.6, minImportanceScore: 0.5 },
  { from: "agent", to: "project", minHitCount: 8, minQualityScore: 0.75, minImportanceScore: 0.65 },
  { from: "project", to: "user", minHitCount: 12, minQualityScore: 0.8, minImportanceScore: 0.75 },
  { from: "user", to: "evolution", minHitCount: 20, minQualityScore: 0.9, minImportanceScore: 0.85 },
];

/**
 * Layer TTL configuration in milliseconds.
 * Each layer has its own retention policy per §29.2:
 * - working (runtime): 30s-5min (shortest, LRU eviction)
 * - session: 1-4 hours (single conversation context)
 * - episodic (agent): 1-7 days (experience chunks, quality-based eviction)
 * - semantic (project): 30-90 days (shared facts, trust-based retention)
 * - procedural (user): 90-365 days (skills/procedures, usage-based retention)
 * - meta (evolution): configurable (performance metrics, importance-based)
 */
export interface LayerTtlConfig {
  /** §29 architecture layer name */
  architectureLayer: string;
  /** Internal scope (legacy name) */
  scope: HierarchicalMemoryLayer;
  /** Default TTL in milliseconds */
  defaultTtlMs: number;
  /** Maximum TTL in milliseconds */
  maxTtlMs: number;
  /** Minimum TTL in milliseconds */
  minTtlMs: number;
  /** Eviction strategy for this layer */
  evictionStrategy: EvictionStrategy;
  /** Whether this layer supports promotion */
  supportsPromotion: boolean;
  /** Whether this layer supports demotion */
  supportsDemotion: boolean;
  /** Description of the layer's purpose */
  description: string;
}

/**
 * Eviction strategies for memory layers per §29.2.
 */
export type EvictionStrategy =
  /** Least Recently Used - evict oldest accessed first */
  | "lru"
  /** Quality-based - evict lowest quality score first */
  | "quality"
  /** Trust-based - evict lowest trust level first */
  | "trust"
  /** Usage-based - evict least frequently accessed first */
  | "usage"
  /** Importance-based - evict lowest importance score first */
  | "importance"
  /** FIFO - evict oldest created first */
  | "fifo";

/**
 * Default TTL configurations per §29.2.
 * Maps internal scopes to architecture layer names and TTL values.
 */
export const DEFAULT_LAYER_TTL_CONFIGS: readonly LayerTtlConfig[] = [
  {
    architectureLayer: "working",
    scope: "runtime",
    defaultTtlMs: 60_000,        // 1 minute
    maxTtlMs: 300_000,          // 5 minutes
    minTtlMs: 30_000,           // 30 seconds
    evictionStrategy: "lru",
    supportsPromotion: true,
    supportsDemotion: false,
    description: "Short-term working memory for active task context. Highest frequency updates, lowest latency.",
  },
  {
    architectureLayer: "session",
    scope: "session",
    defaultTtlMs: 3_600_000,    // 1 hour
    maxTtlMs: 4 * 3_600_000,  // 4 hours
    minTtlMs: 1 * 3_600_000,  // 1 hour
    evictionStrategy: "lru",
    supportsPromotion: true,
    supportsDemotion: true,
    description: "Single conversation session context. Retains all turns within a session.",
  },
  {
    architectureLayer: "episodic",
    scope: "agent",
    defaultTtlMs: 7 * 24 * 3_600_000,  // 7 days
    maxTtlMs: 7 * 24 * 3_600_000,      // 7 days
    minTtlMs: 1 * 24 * 3_600_000,      // 1 day
    evictionStrategy: "quality",
    supportsPromotion: true,
    supportsDemotion: true,
    description: "Experience chunks from completed tasks/sessions. Moderate retention with quality-based eviction.",
  },
  {
    architectureLayer: "semantic",
    scope: "project",
    defaultTtlMs: 30 * 24 * 3_600_000, // 30 days
    maxTtlMs: 90 * 24 * 3_600_000,    // 90 days
    minTtlMs: 7 * 24 * 3_600_000,     // 7 days
    evictionStrategy: "trust",
    supportsPromotion: true,
    supportsDemotion: true,
    description: "Shared facts, rules, and stable patterns across team/organization. Trust-level gated retention.",
  },
  {
    architectureLayer: "procedural",
    scope: "user",
    defaultTtlMs: 90 * 24 * 3_600_000, // 90 days
    maxTtlMs: 365 * 24 * 3_600_000,   // 365 days
    minTtlMs: 30 * 24 * 3_600_000,    // 30 days
    evictionStrategy: "usage",
    supportsPromotion: false,
    supportsDemotion: true,
    description: "Skills, procedures, and learned behaviors. Longest retention, usage-based eviction.",
  },
  {
    architectureLayer: "meta",
    scope: "evolution",
    defaultTtlMs: 14 * 24 * 3_600_000, // 14 days
    maxTtlMs: 90 * 24 * 3_600_000,    // 90 days
    minTtlMs: 1 * 24 * 3_600_000,     // 1 day
    evictionStrategy: "importance",
    supportsPromotion: true,
    supportsDemotion: true,
    description: "Performance metrics about the learning system itself. Importance-based retention.",
  },
];

/**
 * Maps a §29 architecture layer name to the internal scope name.
 * @param architectureLayer - The §29 architecture layer name
 * @returns The internal scope name
 */
export function architectureLayerToScope(architectureLayer: string): HierarchicalMemoryLayer {
  switch (architectureLayer) {
    case "working":
      return "runtime";
    case "session":
      return "session";
    case "episodic":
      return "agent";
    case "semantic":
      return "project";
    case "procedural":
      return "user";
    case "meta":
      return "evolution";
    default:
      return "project";
  }
}

/**
 * Maps an internal scope to the §29 architecture layer name.
 * @param scope - The internal scope name
 * @returns The §29 architecture layer name
 */
export function scopeToArchitectureLayer(scope: string): string {
  switch (scope) {
    case "task_runtime":
      return "working";
    case "session":
      return "session";
    case "agent":
      return "episodic";
    case "workspace":
    case "project":
      return "semantic";
    case "user":
      return "procedural";
    case "experience":
    case "evolution":
      return "meta";
    default:
      return "semantic";
  }
}

/**
 * Gets the TTL config for a given layer scope.
 * @param scope - The layer scope (internal name)
 * @returns The TTL config for this layer, or undefined
 */
export function getLayerTtlConfig(scope: HierarchicalMemoryLayer): LayerTtlConfig | undefined {
  return DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === scope);
}

/**
 * Gets the TTL config by §29 architecture layer name.
 * @param architectureLayer - The §29 architecture layer name
 * @returns The TTL config for this layer, or undefined
 */
export function getLayerTtlConfigByArchitectureLayer(architectureLayer: string): LayerTtlConfig | undefined {
  return DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.architectureLayer === architectureLayer);
}

/**
 * Checks if a memory record is stale (expired based on TTL).
 * @param memory - The memory record to check
 * @param nowMs - Current time in milliseconds (default: Date.now())
 * @returns True if the memory is stale
 */
export function isMemoryStale(memory: MemoryRecord, nowMs = Date.now()): boolean {
  const config = getLayerTtlConfig(memory.scope as HierarchicalMemoryLayer);

  // If no config found, use a default of 7 days
  if (!config) {
    const createdAtMs = new Date(memory.createdAt).getTime();
    return nowMs - createdAtMs > 7 * 24 * 3_600_000;
  }

  // If explicit expiresAt is set, use it
  if (memory.expiresAt != null) {
    const expiresAtMs = new Date(memory.expiresAt).getTime();
    return nowMs >= expiresAtMs;
  }

  // Fall back to TTL based on layer
  const createdAtMs = new Date(memory.createdAt).getTime();
  const ageMs = nowMs - createdAtMs;
  return ageMs > config.defaultTtlMs;
}

/**
 * Gets the eviction priority for a memory record.
 * Lower values = higher eviction priority (evict first).
 * @param memory - The memory record
 * @returns Eviction priority score (numeric, lower = evict first)
 */
export function getEvictionPriority(memory: MemoryRecord): number {
  const config = getLayerTtlConfig(memory.scope as HierarchicalMemoryLayer);
  const strategy = config?.evictionStrategy ?? "lru";

  switch (strategy) {
    case "lru": {
      const now = Date.now();
      const lastAccessed = memory.lastAccessedAt
        ? new Date(memory.lastAccessedAt).getTime()
        : new Date(memory.createdAt).getTime();
      // Normalize to 0-1: older items get lower values (evicted first)
      // priority = lastAccessed / now ranges from ~0 (ancient) to ~1 (just accessed)
      return lastAccessed / now;
    }
    case "quality": {
      const quality = memory.qualityScore ?? 0.5;
      return 1 - quality;
    }
    case "trust": {
      const trustWeights: Record<string, number> = {
        private_unverified: 0.2,
        team_reviewed: 0.5,
        official: 0.75,
        authoritative: 1.0,
      };
      const trust = trustWeights[memory.sourceTrustLevel] ?? 0.5;
      return 1 - trust;
    }
    case "usage": {
      return 1 / (memory.hitCount + 1);
    }
    case "importance": {
      const importance = memory.importanceScore ?? 0.5;
      return 1 - importance;
    }
    case "fifo": {
      return new Date(memory.createdAt).getTime();
    }
    default:
      return new Date(memory.createdAt).getTime();
  }
}

/**
 * Determines if a memory should be evicted based on its layer's eviction strategy.
 * R16-39 FIX: §29.2 requires loss-report/escalation when facts are evicted.
 * Callers must check the return value and generate/log a ContextTruncationReport
 * when eviction is triggered. The eviction itself does not silently discard data.
 *
 * @param memory - The memory record to evaluate
 * @param candidateCount - Number of candidate memories in the same layer
 * @param maxLayerSize - Maximum size for this layer (optional)
 * @returns true if the memory should be evicted (caller must generate loss report)
 */
export function shouldEvict(
  memory: MemoryRecord,
  candidateCount: number,
  maxLayerSize?: number,
): boolean {
  if (isMemoryStale(memory)) {
    return true;
  }
  if (maxLayerSize === undefined) {
    return false;
  }
  if (candidateCount <= maxLayerSize) {
    return false;
  }
  const priority = getEvictionPriority(memory);
  return candidateCount > maxLayerSize && priority < 0.5;
}

export function mapMemoryScopeToLayer(scope: string): HierarchicalMemoryLayer {
  switch (scope) {
    case "task_runtime":
      return "runtime";
    case "session":
      return "session";
    case "agent":
      return "agent";
    case "workspace":
    case "project":
      return "project";
    case "user":
      return "user";
    case "experience":
    case "evolution":
      return "evolution";
    default:
      return "project";
  }
}

export function cloneMemoryWithLayer(memory: MemoryRecord, layer: HierarchicalMemoryLayer): MemoryRecord {
  return {
    ...memory,
    scope: layer === "project" ? "project" : layer,
  };
}

/**
 * Creates a ContextTruncationReport when records are evicted from a layer.
 * §29.2: "Facts cannot be silently discarded, compression requires loss report"
 */
export function createContextTruncationReport(
  layer: HierarchicalMemoryLayer,
  evictedRecords: MemoryRecord[],
  reason: EvictionReason,
): ContextTruncationReport {
  const evicted: EvictedMemoryRecord[] = evictedRecords.map((record) => ({
    recordId: record.id,
    scope: record.scope,
    key: record.id, // Use id as key since MemoryRecord has no key field
    createdAt: record.createdAt,
    lastAccessedAt: record.lastAccessedAt ?? null,
    ttlMs: getLayerTtlConfig(record.scope as HierarchicalMemoryLayer)?.defaultTtlMs ?? 0,
    priority: getEvictionPriority(record),
    qualityScore: record.qualityScore ?? null,
    importanceScore: record.importanceScore ?? null,
  }));

  // Estimate size: assume average record is ~2KB
  const estimatedSizeBytes = evictedRecords.length * 2048;

  return {
    layer,
    evictedRecords: evicted,
    totalEvicted: evictedRecords.length,
    evictedSizeBytes: estimatedSizeBytes,
    reason,
    timestamp: new Date().toISOString(),
  };
}
