/**
 * Knowledge Query Service
 *
 * Provides three-tier query levels (Quick/Standard/Deep) for knowledge retrieval,
 * with adaptive level selection based on query confidence.
 *
 * Design: §10 three-tier query levels
 * - Quick: L1 runtime cache only, <50ms, topK=3
 * - Standard: keyword + semantic, <200ms, topK=10
 * - Deep: full pipeline + graph traversal, <2s, topK=30
 */
import type { RetrievalHit } from "./knowledge-model.js";
import { AstStructuralIndex } from "./indexing/ast-index.js";
import { KnowledgeRetrievalService, type KnowledgeQueryOptions } from "./retrieval/knowledge-retrieval.js";
import type { SemanticKnowledgeGraph } from "./semantic-knowledge-graph.js";
/** Query depth levels per §10 design */
export declare enum QueryLevel {
    /** L1 runtime cache only, <50ms, topK=3 */
    Quick = "quick",
    /** Keyword + semantic, <200ms, topK=10 */
    Standard = "standard",
    /** Full pipeline + graph traversal, <2s, topK=30 */
    Deep = "deep"
}
/** Configuration for three-tier query */
export interface KnowledgeQueryServiceConfig {
    /** Max tokens for Quick mode result */
    quickMaxTokens: number;
    /** Max tokens for Standard mode result */
    standardMaxTokens: number;
    /** Max tokens for Deep mode result */
    deepMaxTokens: number;
    /** Confidence threshold below which Quick auto-upgrades to Standard */
    quickConfidenceThreshold: number;
    /** TTL for L1 cache entries in ms */
    l1CacheTtlMs: number;
    /** Max L1 cache entries */
    l1CacheMaxEntries: number;
}
/**
 * Knowledge Query Service with three-tier query levels.
 *
 * Usage:
 * ```
 * const service = new KnowledgeQueryService(retrievalService, config);
 * const hits = service.query("How do I authenticate?", { namespace: "docs" });
 * const asyncHits = await service.queryAsync("API rate limits", {}, QueryLevel.Deep);
 * const suggestedLevel = service.selectQueryLevel(previousConfidence);
 * ```
 */
export declare class KnowledgeQueryService {
    private readonly config;
    private readonly l1Cache;
    private readonly retrievalService;
    private readonly astIndex;
    private readonly semanticGraph;
    /** Track last query confidence for adaptive upgrade decisions */
    private lastConfidence;
    constructor(retrievalService: KnowledgeRetrievalService, config?: Partial<KnowledgeQueryServiceConfig>, astIndex?: AstStructuralIndex, semanticGraph?: SemanticKnowledgeGraph | null);
    /**
     * Determine appropriate query level based on prior confidence score.
     * Quick queries auto-upgrade to Standard when confidence is below threshold.
     */
    selectQueryLevel(confidence: number): QueryLevel;
    /**
     * Synchronous query with default Standard level.
     */
    query(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];
    /**
     * Asynchronous query with explicit level control.
     */
    queryAsync(keyword: string, options?: KnowledgeQueryOptions, level?: QueryLevel): Promise<RetrievalHit[]>;
    /**
     * Adaptive query: automatically selects level based on last confidence.
     * Falls back to Standard on first query.
     */
    queryAdaptive(keyword: string, options?: KnowledgeQueryOptions): RetrievalHit[];
    /**
     * Synchronous query with explicit level.
     */
    private queryWithLevel;
    /**
     * Async query with explicit level.
     */
    private queryWithLevelAsync;
    /**
     * Quick: L1 cache only, no external data access.
     * Returns cached hits or empty with quickMiss marker.
     */
    private executeQuickQuery;
    /**
     * Standard: keyword + semantic search via KnowledgeRetrievalService.
     * topK=10, limit enforced by options.limit (default 10).
     */
    private executeStandardQuery;
    /**
     * Standard async: delegates to KnowledgeRetrievalService.queryAsync.
     */
    private executeStandardQueryAsync;
    /**
     * Deep: full pipeline including graph traversal and cross-namespace expansion.
     * topK=30. Uses semantic graph for cross-ref enrichment.
     *
     */
    private executeDeepQuery;
    /**
     * Expand hits with graph traversal (structural relationships).
     * Related chunks from same document and shared keyword neighbors are boosted.
     */
    private expandWithGraphTraversal;
    private toStructuralHit;
    private mergeHits;
    /**
     * Compute a rough confidence score from retrieval hits.
     * Higher average score and more hits = higher confidence.
     */
    private computeConfidence;
    /**
     * Truncate hits to max tokens by trimming snippets.
     * Note: This is a simplified token approximation (4 chars ≈ 1 token).
     */
    private truncateHits;
    /** Get last query confidence (for adaptive next-level selection) */
    getLastConfidence(): number;
    /** Clear L1 cache */
    clearCache(): void;
}
