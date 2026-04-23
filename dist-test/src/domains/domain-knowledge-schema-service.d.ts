/**
 * Domain Knowledge Schema Service
 *
 * Handles knowledge schema operations including:
 * - Knowledge source management (add/remove/refresh)
 * - Retrieval with configured strategy
 * - Freshness policy enforcement
 * - Conflict resolution
 *
 * As defined in architecture doc §37.4 DomainKnowledgeSchema.
 */
import { type DomainKnowledgeSchema, type KnowledgeSource, type RetrievalStrategy } from "./knowledge-schema/index.js";
export interface KnowledgeQuery {
    readonly query: string;
    readonly maxResults?: number;
    readonly minRelevanceScore?: number;
    readonly domainId: string;
    readonly namespaceFilter?: readonly string[];
}
export interface KnowledgeResult {
    readonly resultId: string;
    readonly sourceId: string;
    readonly content: string;
    readonly relevanceScore: number;
    readonly retrievedAt: string;
    readonly metadata: Record<string, unknown>;
}
export interface KnowledgeRetrievalResult {
    readonly queryId: string;
    readonly domainId: string;
    readonly strategy: RetrievalStrategy;
    readonly results: readonly KnowledgeResult[];
    readonly totalResults: number;
    readonly executionTimeMs: number;
}
export interface ConflictResolutionResult {
    readonly conflictId: string;
    readonly namespaceId: string;
    readonly resolvedEntries: readonly {
        readonly key: string;
        readonly value: unknown;
        readonly source: string;
        readonly resolvedAt: string;
    }[];
    readonly conflicts: readonly {
        readonly key: string;
        readonly values: readonly {
            value: unknown;
            source: string;
            timestamp: string;
        }[];
    }[];
}
export interface FreshnessCheckResult {
    readonly schemaId: string;
    readonly domainId: string;
    readonly isFresh: boolean;
    readonly stalenessHours: number;
    readonly maxStalenessHours: number;
    readonly refreshRecommended: boolean;
    readonly lastRefreshAt: string | null;
}
export declare class DomainKnowledgeSchemaService {
    private readonly schemas;
    private readonly sourceContent;
    private readonly sourceTimestamps;
    register(schema: DomainKnowledgeSchema): void;
    getSchema(domainId: string): DomainKnowledgeSchema | null;
    retrieve(query: KnowledgeQuery): KnowledgeRetrievalResult;
    resolveConflicts(domainId: string, namespaceId: string, entries: Record<string, unknown>): ConflictResolutionResult;
    checkFreshness(domainId: string): FreshnessCheckResult;
    refreshSource(domainId: string, sourceId: string, content: string): KnowledgeSource | null;
    addSource(domainId: string, source: KnowledgeSource): KnowledgeSource | null;
    removeSource(domainId: string, sourceId: string): boolean;
    private initializeSources;
    private executeRetrieval;
    private computeRelevance;
    private resolveWinner;
    private findSourcesForKey;
    private getSourceContent;
    private storeSourceContent;
    private getSourceTimestamp;
    private updateSourceTimestamp;
    private defaultStrategy;
    private defaultFreshnessPolicy;
    private requireSchema;
}
