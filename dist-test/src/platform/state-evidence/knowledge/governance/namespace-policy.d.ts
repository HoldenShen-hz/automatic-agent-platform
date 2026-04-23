import type { KnowledgeNamespace } from "../knowledge-model.js";
/**
 * Namespace validation result with policy decision details.
 */
export interface NamespaceValidationResult {
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
    readonly namespace: KnowledgeNamespace | null;
}
/**
 * Namespace strategy configuration for §50 knowledge domain isolation.
 *
 * Defines how namespaces interact with cross-domain access,
 * freshness policies, and trust levels.
 */
export interface NamespaceStrategyConfig {
    /** Enable strict isolation between namespaces */
    strictIsolation: boolean;
    /** Allow cross-namespace retrieval with approval */
    crossNamespaceRetrieval: boolean;
    /** Enforce freshness policy on all operations */
    enforceFreshness: boolean;
    /** Minimum trust level for cross-domain access */
    minTrustLevelForCrossDomain: "verified" | "reviewed" | "community" | "unverified";
}
/**
 * Default namespace strategy configuration.
 * §50: moderate isolation with cross-namespace retrieval allowed.
 */
export declare const DEFAULT_NAMESPACE_STRATEGY: NamespaceStrategyConfig;
/**
 * Namespace conflict detection result.
 */
export interface NamespaceConflict {
    readonly pathA: string;
    readonly pathB: string;
    readonly overlapType: "exact" | "prefix" | "sibling";
    readonly resolution: "allow" | "merge" | "reject";
}
/**
 * Namespace policy store with enhanced §50 strategy support.
 *
 * Provides namespace registration, validation, and conflict detection
 * for knowledge domain isolation.
 */
export declare class NamespacePolicyStore {
    private readonly namespaces;
    private readonly strategyConfig;
    constructor(config?: Partial<NamespaceStrategyConfig>);
    /**
     * Registers a namespace with validation.
     *
     * §50 Strategy: Validates namespace path, freshness policy,
     * and checks for conflicts with existing namespaces.
     */
    register(namespace: KnowledgeNamespace): KnowledgeNamespace;
    /**
     * Gets a namespace by path.
     */
    get(path: string): KnowledgeNamespace | null;
    /**
     * Lists all registered namespaces.
     */
    list(): KnowledgeNamespace[];
    /**
     * Validates a namespace against §50 strategy constraints.
     *
     * Checks:
     * - Path format validity
     * - Freshness policy configuration
     * - Trust level requirements for cross-domain access
     */
    validate(namespace: unknown): NamespaceValidationResult;
    /**
     * Validates a namespace or throws if invalid.
     */
    private validateOrThrow;
    /**
     * Checks if a namespace path is valid.
     * §50 Strategy: Paths must be lowercase, dot- or slash-separated, and start with domain prefix.
     * Segment names may contain hyphens (e.g., "test/file-default" is valid).
     */
    private isValidNamespacePath;
    /**
     * Detects path conflicts with existing namespaces.
     *
     * Returns conflict information for:
     * - Exact matches (same path)
     * - Prefix conflicts (one path is a prefix of another)
     * - Sibling conflicts (same parent domain)
     */
    detectPathConflicts(newPath: string): NamespaceConflict[];
    /**
     * Checks if two paths are siblings (share the same parent domain).
     */
    private areSiblingPaths;
    /**
     * Checks if cross-namespace retrieval is allowed.
     * §50 Strategy: Respects configuration for cross-namespace access.
     */
    canAccessCrossNamespace(sourceNamespace: KnowledgeNamespace, targetNamespace: KnowledgeNamespace): boolean;
    /**
     * Gets namespaces owned by a specific domain.
     */
    getByDomain(domainId: string): KnowledgeNamespace[];
    /**
     * Checks if a namespace is stale based on its freshness policy.
     */
    isStale(namespace: KnowledgeNamespace, lastUpdated: string): boolean;
    /**
     * Gets the current strategy configuration.
     */
    getStrategyConfig(): Readonly<NamespaceStrategyConfig>;
    /**
     * Updates the strategy configuration.
     */
    updateStrategy(config: Partial<NamespaceStrategyConfig>): void;
}
