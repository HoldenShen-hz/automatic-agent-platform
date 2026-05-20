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
import { AstStructuralIndex, type AstIndexedSymbol } from "./indexing/ast-index.js";
import { KnowledgeRetrievalService, type KnowledgeQueryOptions } from "./retrieval/knowledge-retrieval.js";
import type { SemanticKnowledgeGraph } from "./semantic-knowledge-graph.js";
import { ValidationError } from "../../contracts/errors.js";

/** Query depth levels per §10 design */
export enum QueryLevel {
  /** L1 runtime cache only, <50ms, topK=3 */
  Quick = "quick",
  /** Keyword + semantic, <200ms, topK=10 */
  Standard = "standard",
  /** Full pipeline + graph traversal, <2s, topK=30 */
  Deep = "deep",
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

const DEFAULT_CONFIG: KnowledgeQueryServiceConfig = {
  quickMaxTokens: 500,
  standardMaxTokens: 2000,
  deepMaxTokens: 8000,
  quickConfidenceThreshold: 0.5,
  l1CacheTtlMs: 60_000, // 1 minute
  l1CacheMaxEntries: 100,
};

/** L1 runtime cache entry */
interface L1CacheEntry {
  hits: RetrievalHit[];
  timestamp: number;
  queryLevel: QueryLevel;
}

type L1CacheContext = Pick<KnowledgeQueryOptions, "namespace" | "domainId" | "limit" | "maxContextTokens"> & {
  principalId?: string;
};

/**
 * L1 in-memory cache for Quick query mode.
 * Simple Map-based LRU cache with TTL.
 */
class L1QueryCache {
  private readonly cache = new Map<string, L1CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  public constructor(maxEntries: number, ttlMs: number) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  private cacheKey(keyword: string, context: L1CacheContext): string {
    return JSON.stringify({
      keyword,
      namespace: context.namespace ?? null,
      domainId: context.domainId ?? null,
      limit: context.limit ?? null,
      maxContextTokens: context.maxContextTokens ?? null,
      principalId: context.principalId ?? null,
    });
  }

  public get(keyword: string, context: L1CacheContext): RetrievalHit[] | null {
    const key = this.cacheKey(keyword, context);
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

  public set(keyword: string, context: L1CacheContext, hits: RetrievalHit[], level: QueryLevel): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    const key = this.cacheKey(keyword, context);
    this.cache.set(key, { hits, timestamp: Date.now(), queryLevel: level });
  }

  public clear(): void {
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
  private readonly config: KnowledgeQueryServiceConfig;
  private readonly l1Cache: L1QueryCache;
  private readonly retrievalService: KnowledgeRetrievalService;
  private readonly astIndex: AstStructuralIndex;
  private readonly semanticGraph: SemanticKnowledgeGraph | null;

  /** Track last query confidence for adaptive upgrade decisions */
  private lastConfidence: number = 1.0;

  public constructor(
    retrievalService: KnowledgeRetrievalService,
    config: Partial<KnowledgeQueryServiceConfig> = {},
    astIndex: AstStructuralIndex = new AstStructuralIndex(),
    semanticGraph: SemanticKnowledgeGraph | null = null,
  ) {
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
  public selectQueryLevel(confidence: number): QueryLevel {
    if (confidence < this.config.quickConfidenceThreshold) {
      return QueryLevel.Standard;
    }
    return QueryLevel.Quick;
  }

  /**
   * Synchronous query with default Standard level.
   */
  public query(keyword: string, options: KnowledgeQueryOptions = {}): RetrievalHit[] {
    return this.queryWithLevel(keyword, options, QueryLevel.Standard);
  }

  /**
   * Asynchronous query with explicit level control.
   */
  public async queryAsync(keyword: string, options: KnowledgeQueryOptions = {}, level: QueryLevel = QueryLevel.Standard): Promise<RetrievalHit[]> {
    return this.queryWithLevelAsync(keyword, options, level);
  }

  /**
   * Adaptive query: automatically selects level based on last confidence.
   * Falls back to Standard on first query.
   */
  public queryAdaptive(keyword: string, options: KnowledgeQueryOptions = {}): RetrievalHit[] {
    const level = this.lastConfidence > 0 ? this.selectQueryLevel(this.lastConfidence) : QueryLevel.Standard;
    return this.queryWithLevel(keyword, options, level);
  }

  public queryFederated(
    keyword: string,
    namespaces: readonly string[],
    options: KnowledgeQueryOptions = {},
    level: QueryLevel = QueryLevel.Standard,
  ): RetrievalHit[] {
    return this.mergeFederatedHits(
      namespaces.map((namespace) => this.queryWithLevel(keyword, { ...options, namespace }, level)),
      options.limit,
    );
  }

  public async queryFederatedAsync(
    keyword: string,
    namespaces: readonly string[],
    options: KnowledgeQueryOptions = {},
    level: QueryLevel = QueryLevel.Standard,
  ): Promise<RetrievalHit[]> {
    const hitGroups = await Promise.all(
      namespaces.map((namespace) => this.queryWithLevelAsync(keyword, { ...options, namespace }, level)),
    );
    return this.mergeFederatedHits(hitGroups, options.limit);
  }

  /**
   * Synchronous query with explicit level.
   */
  private queryWithLevel(keyword: string, options: KnowledgeQueryOptions, level: QueryLevel): RetrievalHit[] {
    // R5-49: Validate tenant/domain boundary before querying
    this.validateQueryBoundaries(options);

    switch (level) {
      case QueryLevel.Quick:
        return this.executeQuickQuery(keyword, options);
      case QueryLevel.Standard:
        return this.executeStandardQuery(keyword, options);
      case QueryLevel.Deep:
        throw new ValidationError(
          "knowledge_query.deep_requires_async",
          "Deep knowledge queries require queryAsync.",
        );
    }
  }

  /**
   * R5-49: Validates tenant and domain boundaries for query access.
   * Queries without proper domain context are restricted to shared/public namespaces.
   * Validates that accessPrincipal's domain matches the query domain when provided.
   */
  private validateQueryBoundaries(options: KnowledgeQueryOptions): void {
    const { namespace, domainId, accessPrincipal } = options;
    if (domainId != null && accessPrincipal == null) {
      throw new ValidationError(
        "knowledge_query.principal_required",
        "Scoped knowledge queries require an access principal.",
        { details: { domainId, namespace } },
      );
    }

    // R5-49 fix: Validate tenant/domain boundary using accessPrincipal
    // If accessPrincipal has a domainId, ensure query domain matches or is compatible
    if (accessPrincipal?.domainId != null) {
      const principalDomainId = accessPrincipal.domainId;
      // If query has a domainId, it must match the principal's domain
      if (domainId != null && domainId !== principalDomainId) {
        // Check if principal has cross_domain_reader role for cross-domain access
        const hasCrossDomainAccess = accessPrincipal.roles?.includes("cross_domain_reader");
        if (!hasCrossDomainAccess) {
          throw new ValidationError(
            "knowledge_query.domain_principal_mismatch",
            "Query domain does not match principal's domain",
            { details: { principalDomainId, queryDomainId: domainId } },
          );
        }
      }
      // If no query domain specified, restrict namespace to principal's permitted namespaces
      if (domainId == null && namespace != null && namespace !== "shared") {
        const permittedNamespaces = accessPrincipal.permittedNamespaces;
        if (permittedNamespaces && !permittedNamespaces.includes(namespace)) {
          throw new ValidationError(
            "knowledge_query.namespace_not_permitted",
            "Namespace not in principal's permitted namespaces",
            { details: { namespace, permittedNamespaces } },
          );
        }
      }
    }

    // If no domain context provided, restrict to shared namespace only
    if (domainId == null && accessPrincipal?.domainId == null) {
      // Allow only if explicitly requesting shared namespace
      if (namespace !== undefined && namespace !== "shared") {
        throw new ValidationError(
          "knowledge_query.domain_boundary_violation",
          "Query requires domain context for non-shared namespaces",
          { details: { namespace, domainId } },
        );
      }
    }
  }

  private mergeFederatedHits(hitGroups: readonly RetrievalHit[][], limit?: number): RetrievalHit[] {
    const deduped = new Map<string, RetrievalHit>();
    for (const hits of hitGroups) {
      for (const hit of hits) {
        const key = this.hitDedupKey(hit);
        const existing = deduped.get(key);
        if (existing == null || hit.score > existing.score) {
          deduped.set(key, hit);
        }
      }
    }
    return [...deduped.values()]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return this.hitDedupKey(left).localeCompare(this.hitDedupKey(right));
      })
      .slice(0, limit ?? 10);
  }

  private cacheContext(options: KnowledgeQueryOptions): L1CacheContext {
    return {
      namespace: options.namespace,
      domainId: options.domainId,
      limit: options.limit,
      maxContextTokens: options.maxContextTokens,
      principalId: options.accessPrincipal?.principalId,
    };
  }

  private hitDedupKey(hit: RetrievalHit): string {
    return `${hit.namespace}:${hit.documentId}:${hit.chunkId}`;
  }

  /**
   * Async query with explicit level.
   */
  private async queryWithLevelAsync(keyword: string, options: KnowledgeQueryOptions, level: QueryLevel): Promise<RetrievalHit[]> {
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
  private executeQuickQuery(keyword: string, options: KnowledgeQueryOptions): RetrievalHit[] {
    const cached = this.l1Cache.get(keyword, this.cacheContext(options));
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
  private executeStandardQuery(keyword: string, options: KnowledgeQueryOptions): RetrievalHit[] {
    const limit = options.limit ?? 10;
    const hits = this.retrievalService.query(keyword, { ...options, limit });
    this.lastConfidence = this.computeConfidence(hits);
    this.l1Cache.set(keyword, this.cacheContext(options), hits, QueryLevel.Standard);
    return this.truncateHits(hits, options.maxContextTokens ?? this.config.standardMaxTokens);
  }

  /**
   * Standard async: delegates to KnowledgeRetrievalService.queryAsync.
   */
  private async executeStandardQueryAsync(keyword: string, options: KnowledgeQueryOptions): Promise<RetrievalHit[]> {
    const limit = options.limit ?? 10;
    const hits = await this.retrievalService.queryAsync(keyword, { ...options, limit });
    this.lastConfidence = this.computeConfidence(hits);
    this.l1Cache.set(keyword, this.cacheContext(options), hits, QueryLevel.Standard);
    return this.truncateHits(hits, options.maxContextTokens ?? this.config.standardMaxTokens);
  }

  /**
   * Deep: full pipeline including graph traversal and cross-namespace expansion.
   * topK=30. Uses semantic graph for cross-ref enrichment.
   *
   */
  private async executeDeepQuery(keyword: string, options: KnowledgeQueryOptions): Promise<RetrievalHit[]> {
    const limit = options.limit ?? 30;
    const hits = await this.retrievalService.queryAsync(keyword, { ...options, limit });
    const expandedHits = await this.expandWithGraphTraversal(hits, keyword, options.namespace);
    const ns = options.namespace;
    const queryOptions: { query: string; limit: number; namespace?: string } = ns !== undefined
      ? { query: keyword, limit, namespace: ns }
      : { query: keyword, limit };
    const structuralHits = this.astIndex
      .query(queryOptions)
      .map((symbol) => this.toStructuralHit(symbol));
    const mergedHits = this.mergeHits(expandedHits, structuralHits, limit);

    this.lastConfidence = this.computeConfidence(mergedHits);
    this.l1Cache.set(keyword, this.cacheContext(options), mergedHits, QueryLevel.Deep);
    return this.truncateHits(mergedHits, options.maxContextTokens ?? this.config.deepMaxTokens);
  }

  /**
   * Expand hits with graph traversal (structural relationships).
   * Related chunks from same document and shared keyword neighbors are boosted.
   */
  private async expandWithGraphTraversal(
    hits: RetrievalHit[],
    keyword: string,
    namespace: string | undefined,
  ): Promise<RetrievalHit[]> {
    if (!this.semanticGraph) {
      return hits;
    }
    const relatedRefs = new Set<string>();
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
        matchType: "structural" as const,
        snippet: `Related knowledge path for ${knowledgeRef}`,
        namespace: namespace ?? "shared",
        knowledgeRef,
        reasoningSummary: "semantic_graph_neighbor",
      }));
    return this.mergeHits(hits, additionalHits, hits.length + additionalHits.length);
  }

  private toStructuralHit(symbol: AstIndexedSymbol): RetrievalHit {
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

  private mergeHits(primary: readonly RetrievalHit[], secondary: readonly RetrievalHit[], limit: number): RetrievalHit[] {
    const merged = new Map<string, RetrievalHit>();
    for (const hit of [...primary, ...secondary]) {
      const current = merged.get(this.hitDedupKey(hit));
      if (!current || hit.score > current.score) {
        merged.set(this.hitDedupKey(hit), hit);
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
  private computeConfidence(hits: RetrievalHit[]): number {
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
  private truncateHits(hits: RetrievalHit[], maxTokens: number): RetrievalHit[] {
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
  public getLastConfidence(): number {
    return this.lastConfidence;
  }

  /** Clear L1 cache */
  public clearCache(): void {
    this.l1Cache.clear();
  }
}
