export const DEFAULT_MEMORY_PROMOTION_RULES = [
    { from: "session", to: "agent", minHitCount: 3, minQualityScore: 0.6, minImportanceScore: 0.5 },
    { from: "agent", to: "project", minHitCount: 8, minQualityScore: 0.75, minImportanceScore: 0.65 },
    { from: "project", to: "user", minHitCount: 12, minQualityScore: 0.8, minImportanceScore: 0.75 },
    { from: "user", to: "evolution", minHitCount: 20, minQualityScore: 0.9, minImportanceScore: 0.85 },
];
/**
 * Default TTL configurations per §29.2.
 * Maps internal scopes to architecture layer names and TTL values.
 */
export const DEFAULT_LAYER_TTL_CONFIGS = [
    {
        architectureLayer: "working",
        scope: "runtime",
        defaultTtlMs: 60_000, // 1 minute
        maxTtlMs: 300_000, // 5 minutes
        minTtlMs: 30_000, // 30 seconds
        evictionStrategy: "lru",
        supportsPromotion: true,
        supportsDemotion: false,
        description: "Short-term working memory for active task context. Highest frequency updates, lowest latency.",
    },
    {
        architectureLayer: "session",
        scope: "session",
        defaultTtlMs: 3_600_000, // 1 hour
        maxTtlMs: 4 * 3_600_000, // 4 hours
        minTtlMs: 1 * 3_600_000, // 1 hour
        evictionStrategy: "lru",
        supportsPromotion: true,
        supportsDemotion: true,
        description: "Single conversation session context. Retains all turns within a session.",
    },
    {
        architectureLayer: "episodic",
        scope: "agent",
        defaultTtlMs: 7 * 24 * 3_600_000, // 7 days
        maxTtlMs: 7 * 24 * 3_600_000, // 7 days
        minTtlMs: 1 * 24 * 3_600_000, // 1 day
        evictionStrategy: "quality",
        supportsPromotion: true,
        supportsDemotion: true,
        description: "Experience chunks from completed tasks/sessions. Moderate retention with quality-based eviction.",
    },
    {
        architectureLayer: "semantic",
        scope: "project",
        defaultTtlMs: 30 * 24 * 3_600_000, // 30 days
        maxTtlMs: 90 * 24 * 3_600_000, // 90 days
        minTtlMs: 7 * 24 * 3_600_000, // 7 days
        evictionStrategy: "trust",
        supportsPromotion: true,
        supportsDemotion: true,
        description: "Shared facts, rules, and stable patterns across team/organization. Trust-level gated retention.",
    },
    {
        architectureLayer: "procedural",
        scope: "user",
        defaultTtlMs: 90 * 24 * 3_600_000, // 90 days
        maxTtlMs: 365 * 24 * 3_600_000, // 365 days
        minTtlMs: 30 * 24 * 3_600_000, // 30 days
        evictionStrategy: "usage",
        supportsPromotion: false,
        supportsDemotion: true,
        description: "Skills, procedures, and learned behaviors. Longest retention, usage-based eviction.",
    },
    {
        architectureLayer: "meta",
        scope: "evolution",
        defaultTtlMs: 14 * 24 * 3_600_000, // 14 days
        maxTtlMs: 90 * 24 * 3_600_000, // 90 days
        minTtlMs: 1 * 24 * 3_600_000, // 1 day
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
export function architectureLayerToScope(architectureLayer) {
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
export function scopeToArchitectureLayer(scope) {
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
export function getLayerTtlConfig(scope) {
    return DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === scope);
}
/**
 * Gets the TTL config by §29 architecture layer name.
 * @param architectureLayer - The §29 architecture layer name
 * @returns The TTL config for this layer, or undefined
 */
export function getLayerTtlConfigByArchitectureLayer(architectureLayer) {
    return DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.architectureLayer === architectureLayer);
}
/**
 * Checks if a memory record is stale (expired based on TTL).
 * @param memory - The memory record to check
 * @param nowMs - Current time in milliseconds (default: Date.now())
 * @returns True if the memory is stale
 */
export function isMemoryStale(memory, nowMs = Date.now()) {
    const config = getLayerTtlConfig(memory.scope);
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
export function getEvictionPriority(memory) {
    const config = getLayerTtlConfig(memory.scope);
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
            const trustWeights = {
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
 * @param memory - The memory record to evaluate
 * @param candidateCount - Number of candidate memories in the same layer
 * @param maxLayerSize - Maximum size for this layer (optional)
 * @returns True if the memory should be evicted
 */
export function shouldEvict(memory, candidateCount, maxLayerSize) {
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
export function mapMemoryScopeToLayer(scope) {
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
export function cloneMemoryWithLayer(memory, layer) {
    return {
        ...memory,
        scope: layer === "project" ? "project" : layer,
    };
}
//# sourceMappingURL=memory-layer-model.js.map