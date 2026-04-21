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
import { AstStructuralIndex } from "./indexing/ast-index.js";
/** Query depth levels per §10 design */
export var QueryLevel;
(function (QueryLevel) {
    /** L1 runtime cache only, <50ms, topK=3 */
    QueryLevel["Quick"] = "quick";
    /** Keyword + semantic, <200ms, topK=10 */
    QueryLevel["Standard"] = "standard";
    /** Full pipeline + graph traversal, <2s, topK=30 */
    QueryLevel["Deep"] = "deep";
})(QueryLevel || (QueryLevel = {}));
const DEFAULT_CONFIG = {
    quickMaxTokens: 500,
    standardMaxTokens: 2000,
    deepMaxTokens: 8000,
    quickConfidenceThreshold: 0.5,
    l1CacheTtlMs: 60_000, // 1 minute
    l1CacheMaxEntries: 100,
};
/**
 * L1 in-memory cache for Quick query mode.
 * Simple Map-based LRU cache with TTL.
 */
class L1QueryCache {
    cache = new Map();
    maxEntries;
    ttlMs;
    constructor(maxEntries, ttlMs) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
    }
    cacheKey(keyword, namespace) {
        return `${namespace ?? ""}:${keyword}`;
    }
    get(keyword, namespace) {
        const key = this.cacheKey(keyword, namespace);
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }
        return entry.hits;
    }
    set(keyword, namespace, hits, level) {
        if (this.cache.size >= this.maxEntries) {
            // Evict oldest entry
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        const key = this.cacheKey(keyword, namespace);
        this.cache.set(key, { hits, timestamp: Date.now(), queryLevel: level });
    }
    clear() {
        this.cache.clear();
    }
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
export class KnowledgeQueryService {
    config;
    l1Cache;
    retrievalService;
    astIndex;
    semanticGraph;
    /** Track last query confidence for adaptive upgrade decisions */
    lastConfidence = 1.0;
    constructor(retrievalService, config = {}, astIndex = new AstStructuralIndex(), semanticGraph = null) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.retrievalService = retrievalService;
        this.l1Cache = new L1QueryCache(this.config.l1CacheMaxEntries, this.config.l1CacheTtlMs);
        this.astIndex = astIndex;
        this.semanticGraph = semanticGraph;
    }
    /**
     * Determine appropriate query level based on prior confidence score.
     * Quick queries auto-upgrade to Standard when confidence is below threshold.
     */
    selectQueryLevel(confidence) {
        if (confidence < this.config.quickConfidenceThreshold) {
            return QueryLevel.Standard;
        }
        return QueryLevel.Quick;
    }
    /**
     * Synchronous query with default Standard level.
     */
    query(keyword, options = {}) {
        return this.queryWithLevel(keyword, options, QueryLevel.Standard);
    }
    /**
     * Asynchronous query with explicit level control.
     */
    async queryAsync(keyword, options = {}, level = QueryLevel.Standard) {
        return this.queryWithLevelAsync(keyword, options, level);
    }
    /**
     * Adaptive query: automatically selects level based on last confidence.
     * Falls back to Standard on first query.
     */
    queryAdaptive(keyword, options = {}) {
        const level = this.lastConfidence > 0 ? this.selectQueryLevel(this.lastConfidence) : QueryLevel.Standard;
        return this.queryWithLevel(keyword, options, level);
    }
    /**
     * Synchronous query with explicit level.
     */
    queryWithLevel(keyword, options, level) {
        switch (level) {
            case QueryLevel.Quick:
                return this.executeQuickQuery(keyword, options);
            case QueryLevel.Standard:
                return this.executeStandardQuery(keyword, options);
            case QueryLevel.Deep:
                // Deep requires async, fall back to sync-safe subset
                return this.executeStandardQuery(keyword, { ...options, limit: 30 });
        }
    }
    /**
     * Async query with explicit level.
     */
    async queryWithLevelAsync(keyword, options, level) {
        switch (level) {
            case QueryLevel.Quick:
                return this.executeQuickQuery(keyword, options);
            case QueryLevel.Standard:
                return this.executeStandardQueryAsync(keyword, options);
            case QueryLevel.Deep:
                return this.executeDeepQuery(keyword, options);
        }
    }
    /**
     * Quick: L1 cache only, no external data access.
     * Returns cached hits or empty with quickMiss marker.
     */
    executeQuickQuery(keyword, options) {
        const cached = this.l1Cache.get(keyword, options.namespace);
        if (cached) {
            this.lastConfidence = this.computeConfidence(cached);
            return this.truncateHits(cached, this.config.quickMaxTokens);
        }
        // Quick miss — do not fall through to Standard, return empty
        this.lastConfidence = 0;
        return [];
    }
    /**
     * Standard: keyword + semantic search via KnowledgeRetrievalService.
     * topK=10, limit enforced by options.limit (default 10).
     */
    executeStandardQuery(keyword, options) {
        const limit = options.limit ?? 10;
        const hits = this.retrievalService.query(keyword, { ...options, limit });
        this.lastConfidence = this.computeConfidence(hits);
        this.l1Cache.set(keyword, options.namespace, hits, QueryLevel.Standard);
        return this.truncateHits(hits, this.config.standardMaxTokens);
    }
    /**
     * Standard async: delegates to KnowledgeRetrievalService.queryAsync.
     */
    async executeStandardQueryAsync(keyword, options) {
        const limit = options.limit ?? 10;
        const hits = await this.retrievalService.queryAsync(keyword, { ...options, limit });
        this.lastConfidence = this.computeConfidence(hits);
        this.l1Cache.set(keyword, options.namespace, hits, QueryLevel.Standard);
        return this.truncateHits(hits, this.config.standardMaxTokens);
    }
    /**
     * Deep: full pipeline including graph traversal and cross-namespace expansion.
     * topK=30. Uses semantic graph for cross-ref enrichment.
     *
     */
    async executeDeepQuery(keyword, options) {
        const limit = options.limit ?? 30;
        const hits = await this.retrievalService.queryAsync(keyword, { ...options, limit });
        const expandedHits = await this.expandWithGraphTraversal(hits, keyword, options.namespace);
        const ns = options.namespace;
        const queryOptions = ns !== undefined
            ? { query: keyword, limit, namespace: ns }
            : { query: keyword, limit };
        const structuralHits = this.astIndex
            .query(queryOptions)
            .map((symbol) => this.toStructuralHit(symbol));
        const mergedHits = this.mergeHits(expandedHits, structuralHits, limit);
        this.lastConfidence = this.computeConfidence(mergedHits);
        this.l1Cache.set(keyword, options.namespace, mergedHits, QueryLevel.Deep);
        return this.truncateHits(mergedHits, this.config.deepMaxTokens);
    }
    /**
     * Expand hits with graph traversal (structural relationships).
     * Related chunks from same document and shared keyword neighbors are boosted.
     */
    async expandWithGraphTraversal(hits, keyword, namespace) {
        if (!this.semanticGraph) {
            return hits;
        }
        const relatedRefs = new Set();
        for (const hit of hits) {
            const connections = this.semanticGraph.getChunkConnections(hit.knowledgeRef);
            if (!connections) {
                continue;
            }
            for (const relatedRef of [...connections.sameDocumentRefs, ...connections.sharedKeywordRefs]) {
                relatedRefs.add(relatedRef);
            }
        }
        for (const relatedRef of this.semanticGraph.findChunkKnowledgeRefsByKeyword(keyword, namespace)) {
            relatedRefs.add(relatedRef);
        }
        const additionalHits = [...relatedRefs]
            .filter((knowledgeRef) => !hits.some((hit) => hit.knowledgeRef === knowledgeRef))
            .map((knowledgeRef) => ({
            chunkId: knowledgeRef.replace(/^knowledge:/, ""),
            documentId: knowledgeRef.replace(/^knowledge:/, "document:"),
            score: 0.6,
            matchType: "structural",
            snippet: `Related knowledge path for ${knowledgeRef}`,
            namespace: namespace ?? "shared",
            knowledgeRef,
            reasoningSummary: "semantic_graph_neighbor",
        }));
        return this.mergeHits(hits, additionalHits, hits.length + additionalHits.length);
    }
    toStructuralHit(symbol) {
        return {
            chunkId: `ast:${symbol.symbolId}`,
            documentId: symbol.documentId,
            score: 1.2,
            matchType: "structural",
            snippet: `${symbol.symbolKind} ${symbol.symbolName} (${symbol.sourceUri}:${symbol.line})\n${symbol.snippet}`,
            namespace: symbol.namespace,
            knowledgeRef: `ast:${symbol.sourceUri}#${symbol.symbolName}`,
            reasoningSummary: `ast_definition:${symbol.symbolKind}`,
        };
    }
    mergeHits(primary, secondary, limit) {
        const merged = new Map();
        for (const hit of [...primary, ...secondary]) {
            const current = merged.get(hit.knowledgeRef);
            if (!current || hit.score > current.score) {
                merged.set(hit.knowledgeRef, hit);
            }
        }
        return [...merged.values()]
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);
    }
    /**
     * Compute a rough confidence score from retrieval hits.
     * Higher average score and more hits = higher confidence.
     */
    computeConfidence(hits) {
        if (hits.length === 0) {
            return 0;
        }
        const avgScore = hits.reduce((sum, h) => sum + h.score, 0) / hits.length;
        // Normalize: typical scores range 0-10, scale to 0-1
        const normalizedScore = Math.min(avgScore / 5, 1);
        // Boost by hit count (more relevant hits = higher confidence)
        const hitCountBonus = Math.min(hits.length / 10, 0.2);
        return Math.min(normalizedScore + hitCountBonus, 1);
    }
    /**
     * Truncate hits to max tokens by trimming snippets.
     * Note: This is a simplified token approximation (4 chars ≈ 1 token).
     */
    truncateHits(hits, maxTokens) {
        const maxChars = maxTokens * 4;
        return hits.map((hit) => {
            if (hit.snippet.length <= maxChars) {
                return hit;
            }
            return {
                ...hit,
                snippet: hit.snippet.slice(0, maxChars) + "…",
            };
        });
    }
    /** Get last query confidence (for adaptive next-level selection) */
    getLastConfidence() {
        return this.lastConfidence;
    }
    /** Clear L1 cache */
    clearCache() {
        this.l1Cache.clear();
    }
}
//# sourceMappingURL=knowledge-query-service.js.map