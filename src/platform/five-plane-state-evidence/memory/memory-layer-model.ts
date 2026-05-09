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
  { from: "runtime", to: "session", minHitCount: 3, minQualityScore: 0.4, minImportanceScore: 0.3 },
  { from: "session", to: "agent", minHitCount: 8, minQualityScore: 0.55, minImportanceScore: 0.5 },
  { from: "agent", to: "project", minHitCount: 15, minQualityScore: 0.7, minImportanceScore: 0.65 },
  { from: "project", to: "user", minHitCount: 25, minQualityScore: 0.8, minImportanceScore: 0.75 },
  { from: "user", to: "evolution", minHitCount: 40, minQualityScore: 0.9, minImportanceScore: 0.85 },
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
    supportsPromotion: true,
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
 * @throws Error if architectureLayer is not recognized
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
      // R24-33 FIX: Throw error for unknown layer instead of silent fallback to "project"
      // Silent fallback causes mis-routing when configuration is incorrect
      throw new Error(`memory.layer_unknown: Unknown architecture layer "${architectureLayer}". Valid layers: working, session, episodic, semantic, procedural, meta.`);
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
      const lastAccessed = memory.lastAccessedAt
        ? new Date(memory.lastAccessedAt).getTime()
        : new Date(memory.createdAt).getTime();
      return lastAccessed;
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
 * Result of context truncation when evicting memories from working layer.
 * Per §29.2, facts must not be silently discarded - compression requires loss report.
 */
export interface ContextTruncationReport {
  evictedMemories: readonly {
    memoryId: string;
    scope: HierarchicalMemoryLayer;
    reason: string;
    qualityScore: number | null;
    importanceScore: number | null;
  }[];
  retainedMemories: number;
  totalEvicted: number;
  truncationTimestamp: string;
}

/**
 * Eviction options for memory layer.
 */
export interface EvictionOptions {
  /**
   * Callback invoked when memory is evicted, providing loss report.
   * Per §29.2, facts must not be silently discarded.
   */
  onEvict?: (memory: MemoryRecord, reason: string) => void;
  /**
   * Optional callback for truncation reports when multiple memories are evicted.
   * Per §29.2, compression requires loss report.
   */
  onTruncation?: (report: ContextTruncationReport) => void;
}

/**
 * Determines if a memory should be evicted based on its layer's eviction strategy.
 * R16-39 fix: Added optional callback for loss reporting when evicting memories.
 * Per §29.2, silent discarding is prohibited - eviction must be reported.
 * @param memory - The memory record to evaluate
 * @param candidateCount - Number of candidate memories in the same layer
 * @param maxLayerSize - Maximum size for this layer (optional)
 * @param onEvict - Optional callback for loss reporting when memory is evicted
 * @returns True if the memory should be evicted
 */
export function shouldEvict(
  memory: MemoryRecord,
  candidateCount: number,
  maxLayerSize?: number,
  onEvict?: (memory: MemoryRecord, reason: string) => void,
): boolean;
export function shouldEvict(
  memory: MemoryRecord,
  candidateCount: number,
  maxLayerSize: number | undefined,
  options?: EvictionOptions,
): boolean;
export function shouldEvict(
  memory: MemoryRecord,
  candidateCount: number,
  maxLayerSize?: number,
  optionsOrOnEvict?: EvictionOptions | ((memory: MemoryRecord, reason: string) => void),
): boolean {
  // Support both old (onEvict callback) and new (options object) signatures
  let onEvict: ((memory: MemoryRecord, reason: string) => void) | undefined;
  let onTruncation: ((report: ContextTruncationReport) => void) | undefined;

  if (typeof optionsOrOnEvict === "function") {
    onEvict = optionsOrOnEvict;
  } else if (optionsOrOnEvict && typeof optionsOrOnEvict === "object") {
    onEvict = optionsOrOnEvict.onEvict;
    onTruncation = optionsOrOnEvict.onTruncation;
  }

  if (isMemoryStale(memory)) {
    // R16-39 fix: Report stale eviction to prevent silent loss
    onEvict?.(memory, "ttl_expired");
    return true;
  }
  if (maxLayerSize === undefined) {
    return false;
  }
  if (candidateCount <= maxLayerSize) {
    return false;
  }
  const config = getLayerTtlConfig(memory.scope as HierarchicalMemoryLayer);
  const strategy = config?.evictionStrategy ?? "lru";
  const priority = getEvictionPriority(memory);
  const normalizedPriority = strategy === "lru" || strategy === "fifo"
    ? (() => {
        const referenceMs = strategy === "lru"
          ? (memory.lastAccessedAt ? new Date(memory.lastAccessedAt).getTime() : new Date(memory.createdAt).getTime())
          : new Date(memory.createdAt).getTime();
        const retentionMs = Math.max(1, config?.defaultTtlMs ?? 7 * 24 * 3_600_000);
        const ageRatio = Math.max(0, Math.min(1, (Date.now() - referenceMs) / retentionMs));
        return 1 - ageRatio;
      })()
    : priority;
  const shouldEvictResult = candidateCount > maxLayerSize && normalizedPriority < 0.5;
  if (shouldEvictResult) {
    // R16-39 fix: Report priority-based eviction to prevent silent loss
    onEvict?.(memory, "capacity_pressure");
  }
  return shouldEvictResult;
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
