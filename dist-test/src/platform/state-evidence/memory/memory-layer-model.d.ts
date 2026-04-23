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
export type HierarchicalMemoryLayer = "runtime" | "session" | "agent" | "project" | "user" | "evolution";
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
export declare const DEFAULT_MEMORY_PROMOTION_RULES: readonly LayerPromotionRule[];
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
"lru"
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
export declare const DEFAULT_LAYER_TTL_CONFIGS: readonly LayerTtlConfig[];
/**
 * Maps a §29 architecture layer name to the internal scope name.
 * @param architectureLayer - The §29 architecture layer name
 * @returns The internal scope name
 */
export declare function architectureLayerToScope(architectureLayer: string): HierarchicalMemoryLayer;
/**
 * Maps an internal scope to the §29 architecture layer name.
 * @param scope - The internal scope name
 * @returns The §29 architecture layer name
 */
export declare function scopeToArchitectureLayer(scope: string): string;
/**
 * Gets the TTL config for a given layer scope.
 * @param scope - The layer scope (internal name)
 * @returns The TTL config for this layer, or undefined
 */
export declare function getLayerTtlConfig(scope: HierarchicalMemoryLayer): LayerTtlConfig | undefined;
/**
 * Gets the TTL config by §29 architecture layer name.
 * @param architectureLayer - The §29 architecture layer name
 * @returns The TTL config for this layer, or undefined
 */
export declare function getLayerTtlConfigByArchitectureLayer(architectureLayer: string): LayerTtlConfig | undefined;
/**
 * Checks if a memory record is stale (expired based on TTL).
 * @param memory - The memory record to check
 * @param nowMs - Current time in milliseconds (default: Date.now())
 * @returns True if the memory is stale
 */
export declare function isMemoryStale(memory: MemoryRecord, nowMs?: number): boolean;
/**
 * Gets the eviction priority for a memory record.
 * Lower values = higher eviction priority (evict first).
 * @param memory - The memory record
 * @returns Eviction priority score (numeric, lower = evict first)
 */
export declare function getEvictionPriority(memory: MemoryRecord): number;
/**
 * Determines if a memory should be evicted based on its layer's eviction strategy.
 * @param memory - The memory record to evaluate
 * @param candidateCount - Number of candidate memories in the same layer
 * @param maxLayerSize - Maximum size for this layer (optional)
 * @returns True if the memory should be evicted
 */
export declare function shouldEvict(memory: MemoryRecord, candidateCount: number, maxLayerSize?: number): boolean;
export declare function mapMemoryScopeToLayer(scope: string): HierarchicalMemoryLayer;
export declare function cloneMemoryWithLayer(memory: MemoryRecord, layer: HierarchicalMemoryLayer): MemoryRecord;
