import type { MemoryRecord } from "../../contracts/types/domain.js";

/**
 * Memory layer type matching §29 architecture naming.
 * Maps to internal scopes:
 * - working     = task_runtime (short-term, high-frequency)
 * - session     = session (single conversation context)
 * - episodic    = agent (experience chunks, moderate retention)
 * - semantic    = project (shared facts, longer retention)
 * - procedural  = user (skills/procedures, longest retention)
 * - meta        = evolution (performance metrics about the learning system)
 */
export type HierarchicalMemoryLayer =
  | "working"
  | "session"
  | "episodic"
  | "semantic"
  | "procedural"
  | "meta";

/**
 * Legacy layer names still used internally in some modules.
 * These are kept for backward compatibility.
 */
export type LegacyMemoryLayer =
  | "runtime"
  | "session"
  | "agent"
  | "project"
  | "user"
  | "evolution";

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
  { from: "session", to: "episodic", minHitCount: 3, minQualityScore: 0.6, minImportanceScore: 0.5 },
  { from: "episodic", to: "semantic", minHitCount: 8, minQualityScore: 0.75, minImportanceScore: 0.65 },
  { from: "semantic", to: "procedural", minHitCount: 12, minQualityScore: 0.8, minImportanceScore: 0.75 },
  { from: "procedural", to: "meta", minHitCount: 20, minQualityScore: 0.9, minImportanceScore: 0.85 },
];

/**
 * Layer TTL configuration in milliseconds.
 * Each layer has its own retention policy per §29 architecture:
 * - working: 30s-5min (shortest, LRU eviction)
 * - session: 1-4 hours (single conversation context)
 * - episodic: 1-7 days (experience chunks, quality-based eviction)
 * - semantic: 30-90 days (shared facts, trust-based retention)
 * - procedural: 90-365 days (skills/procedures, usage-based retention)
 * - meta: configurable (performance metrics, importance-based)
 */
export interface LayerTtlConfig {
  /** Layer this config applies to */
  layer: HierarchicalMemoryLayer;
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
 * Eviction strategies for memory layers.
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
 * Default TTL configurations per §29 architecture.
 * These are the platform defaults; per-tenant overrides are supported.
 */
export const DEFAULT_LAYER_TTL_CONFIGS: readonly LayerTtlConfig[] = [
  {
    layer: "working",
    defaultTtlMs: 60_000,        // 1 minute
    maxTtlMs: 300_000,          // 5 minutes
    minTtlMs: 30_000,           // 30 seconds
    evictionStrategy: "lru",
    supportsPromotion: true,
    supportsDemotion: false,
    description: "Short-term working memory for active task context. Highest frequency updates, lowest latency.",
  },
  {
    layer: "session",
    defaultTtlMs: 3_600_000,    // 1 hour
    maxTtlMs: 4 * 3_600_000,   // 4 hours
    minTtlMs: 1 * 3_600_000,    // 1 hour
    evictionStrategy: "lru",
    supportsPromotion: true,
    supportsDemotion: true,
    description: "Single conversation session context. Retains all turns within a session.",
  },
  {
    layer: "episodic",
    defaultTtlMs: 7 * 24 * 3_600_000,  // 7 days
    maxTtlMs: 7 * 24 * 3_600_000,      // 7 days
    minTtlMs: 1 * 24 * 3_600_000,      // 1 day
    evictionStrategy: "quality",
    supportsPromotion: true,
    supportsDemotion: true,
    description: "Experience chunks from completed tasks/sessions. Moderate retention with quality-based eviction.",
  },
  {
    layer: "semantic",
    defaultTtlMs: 30 * 24 * 3_600_000, // 30 days
    maxTtlMs: 90 * 24 * 3_600_000,     // 90 days
    minTtlMs: 7 * 24 * 3_600_000,      // 7 days
    evictionStrategy: "trust",
    supportsPromotion: true,
    supportsDemotion: true,
    description: "Shared facts, rules, and stable patterns across team/organization. Trust-level gated retention.",
  },
  {
    layer: "procedural",
    defaultTtlMs: 90 * 24 * 3_600_000, // 90 days
    maxTtlMs: 365 * 24 * 3_600_000,    // 365 days
    minTtlMs: 30 * 24 * 3_600_000,     // 30 days
    evictionStrategy: "usage",
    supportsPromotion: false,
    supportsDemotion: true,
    description: "Skills, procedures, and learned behaviors. Longest retention, usage-based eviction.",
  },
  {
    layer: "meta",
    defaultTtlMs: 14 * 24 * 3_600_000, // 14 days
    maxTtlMs: 90 * 24 * 3_600_000,     // 90 days
    minTtlMs: 1 * 24 * 3_600_000,      // 1 day
    evictionStrategy: "importance",
    supportsPromotion: true,
    supportsDemotion: true,
    description: "Performance metrics about the learning system itself. Importance-based retention.",
  },
];

/**
 * Gets the TTL config for a given layer.
 */
export function getLayerTtlConfig(layer: HierarchicalMemoryLayer): LayerTtlConfig {
  const config = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.layer === layer);
  if (!config) {
    throw new Error(`memory_layer.unknown_layer:${layer}`);
  }
  return config;
}

/**
 * Maps a §29 architecture layer name to the internal scope name.
 */
export function architectureLayerToScope(layer: HierarchicalMemoryLayer): string {
  switch (layer) {
    case "working":
      return "task_runtime";
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
 * Maps a legacy scope string to §29 architecture layer.
 */
export function scopeToArchitectureLayer(scope: string): HierarchicalMemoryLayer {
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
 * Checks if a memory record is stale (expired based on TTL).
 * @param memory - The memory record to check
 * @param nowMs - Current time in milliseconds (default: Date.now())
 * @returns True if the memory is stale
 */
export function isMemoryStale(memory: MemoryRecord, nowMs = Date.now()): boolean {
  const layer = scopeToArchitectureLayer(memory.scope);
  const config = getLayerTtlConfig(layer);

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
 * @returns Eviction priority score (0-1, lower = evict first)
 */
export function getEvictionPriority(memory: MemoryRecord): number {
  const layer = scopeToArchitectureLayer(memory.scope);
  const config = getLayerTtlConfig(layer);

  switch (config.evictionStrategy) {
    case "lru": {
      // Lower priority = older lastAccessedAt
      const lastAccessed = memory.lastAccessedAt
        ? new Date(memory.lastAccessedAt).getTime()
        : new Date(memory.createdAt).getTime();
      return lastAccessed;
    }
    case "quality": {
      // Lower priority = lower quality score
      const quality = memory.qualityScore ?? 0.5;
      return 1 - quality;
    }
    case "trust": {
      // Lower priority = lower trust level
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
      // Lower priority = lower hit count
      return 1 / (memory.hitCount + 1);
    }
    case "importance": {
      // Lower priority = lower importance score
      const importance = memory.importanceScore ?? 0.5;
      return 1 - importance;
    }
    case "fifo": {
      // Lower priority = older createdAt
      return new Date(memory.createdAt).getTime();
    }
    default:
      return new Date(memory.createdAt).getTime();
  }
}

/**
 * Determines if a memory should be evicted based on its layer's eviction strategy.
 * @param memory - The memory record to evaluate
 * @param candidateCount - Number of candidate memories in the same layer
 * @param maxLayerSize - Maximum size for this layer (optional)
 * @returns True if the memory should be evicted
 */
export function shouldEvict(
  memory: MemoryRecord,
  candidateCount: number,
  maxLayerSize?: number,
): boolean {
  // Explicit expiration always triggers eviction
  if (isMemoryStale(memory)) {
    return true;
  }

  // If no size constraint, don't evict
  if (maxLayerSize === undefined) {
    return false;
  }

  // If under size limit, don't evict
  if (candidateCount <= maxLayerSize) {
    return false;
  }

  // Above size limit - use eviction priority to decide
  const priority = getEvictionPriority(memory);
  return candidateCount > maxLayerSize && priority < 0.5;
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use scopeToArchitectureLayer instead
 */
export function mapMemoryScopeToLayer(scope: string): LegacyMemoryLayer {
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

export function cloneMemoryWithLayer(memory: MemoryRecord, layer: LegacyMemoryLayer): MemoryRecord {
  const scopeMap: Record<LegacyMemoryLayer, string> = {
    runtime: "task_runtime",
    session: "session",
    agent: "agent",
    project: "project",
    user: "user",
    evolution: "evolution",
  };
  return {
    ...memory,
    scope: scopeMap[layer] ?? "project",
  };
}
