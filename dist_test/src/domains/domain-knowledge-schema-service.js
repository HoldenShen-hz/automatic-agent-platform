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
import { newId, nowIso } from "../platform/contracts/types/ids.js";
export class DomainKnowledgeSchemaService {
    schemas = new Map();
    sourceContent = new Map();
    sourceTimestamps = new Map();
    register(schema) {
        this.schemas.set(schema.domainId, schema);
        this.initializeSources(schema);
    }
    getSchema(domainId) {
        return this.schemas.get(domainId) ?? null;
    }
    retrieve(query) {
        const schema = this.requireSchema(query.domainId);
        const strategy = schema.retrievalStrategy ?? this.defaultStrategy();
        const maxResults = query.maxResults ?? strategy.maxResults;
        const minScore = query.minRelevanceScore ?? strategy.minRelevanceScore;
        const startTime = Date.now();
        const results = this.executeRetrieval(schema, query, strategy, maxResults, minScore);
        return {
            queryId: newId("knowledge_query"),
            domainId: query.domainId,
            strategy,
            results,
            totalResults: results.length,
            executionTimeMs: Date.now() - startTime,
        };
    }
    resolveConflicts(domainId, namespaceId, entries) {
        const schema = this.requireSchema(domainId);
        const conflicts = [];
        const resolved = [];
        const grouped = new Map();
        for (const [key, value] of Object.entries(entries)) {
            const sources = this.findSourcesForKey(schema, key);
            if (sources.length > 1) {
                const conflictValues = sources.map((s) => ({
                    value,
                    source: s.sourceId,
                    timestamp: this.getSourceTimestamp(s.sourceId),
                }));
                grouped.set(key, conflictValues);
            }
        }
        for (const [key, values] of grouped.entries()) {
            conflicts.push({ key, values });
            const winner = this.resolveWinner(schema.conflictResolution, values);
            if (winner) {
                resolved.push({
                    key,
                    value: winner.value,
                    source: winner.source,
                    resolvedAt: nowIso(),
                });
            }
        }
        for (const [key, value] of Object.entries(entries)) {
            if (!grouped.has(key)) {
                resolved.push({
                    key,
                    value,
                    source: "user_input",
                    resolvedAt: nowIso(),
                });
            }
        }
        return {
            conflictId: newId("conflict_resolution"),
            namespaceId,
            resolvedEntries: resolved,
            conflicts,
        };
    }
    checkFreshness(domainId) {
        const schema = this.requireSchema(domainId);
        const freshnessPolicy = schema.freshnessPolicy ?? this.defaultFreshnessPolicy();
        const maxStalenessHours = freshnessPolicy.maxStalenessHours;
        let oldestTimestamp = null;
        for (const sources of this.sourceTimestamps.values()) {
            for (const ts of sources.values()) {
                if (oldestTimestamp === null || ts < oldestTimestamp) {
                    oldestTimestamp = ts;
                }
            }
        }
        const stalenessHours = oldestTimestamp
            ? (Date.now() - new Date(oldestTimestamp).getTime()) / 3_600_000
            : maxStalenessHours * 2;
        return {
            schemaId: schema.schemaId,
            domainId,
            isFresh: stalenessHours <= maxStalenessHours,
            stalenessHours,
            maxStalenessHours,
            refreshRecommended: stalenessHours > maxStalenessHours,
            lastRefreshAt: oldestTimestamp,
        };
    }
    refreshSource(domainId, sourceId, content) {
        const schema = this.requireSchema(domainId);
        const source = schema.knowledgeSources.find((s) => s.sourceId === sourceId);
        if (!source) {
            return null;
        }
        this.storeSourceContent(sourceId, content);
        return source;
    }
    addSource(domainId, source) {
        const schema = this.requireSchema(domainId);
        if (schema.knowledgeSources.some((s) => s.sourceId === source.sourceId)) {
            return null;
        }
        const updated = {
            ...schema,
            knowledgeSources: [...schema.knowledgeSources, source],
        };
        this.schemas.set(domainId, updated);
        return source;
    }
    removeSource(domainId, sourceId) {
        const schema = this.requireSchema(domainId);
        const index = schema.knowledgeSources.findIndex((s) => s.sourceId === sourceId);
        if (index === -1) {
            return false;
        }
        const updated = {
            ...schema,
            knowledgeSources: [
                ...schema.knowledgeSources.slice(0, index),
                ...schema.knowledgeSources.slice(index + 1),
            ],
        };
        this.schemas.set(domainId, updated);
        return true;
    }
    initializeSources(schema) {
        for (const source of schema.knowledgeSources) {
            this.sourceTimestamps.set(source.sourceId, new Map());
        }
    }
    executeRetrieval(schema, query, strategy, maxResults, minScore) {
        const results = [];
        const namespaces = query.namespaceFilter ?? schema.namespaceIds;
        for (const source of schema.knowledgeSources) {
            if (!namespaces.includes(source.sourceId) && !namespaces.includes("*")) {
                continue;
            }
            const content = this.getSourceContent(source.sourceId);
            if (!content) {
                continue;
            }
            const relevanceScore = this.computeRelevance(query.query, content, strategy);
            if (relevanceScore >= minScore) {
                results.push({
                    resultId: newId("knowledge_result"),
                    sourceId: source.sourceId,
                    content,
                    relevanceScore,
                    retrievedAt: nowIso(),
                    metadata: { sourceType: source.type, priority: source.priority },
                });
            }
        }
        const sorted = [...results].sort((a, b) => {
            if (a.relevanceScore !== b.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
            }
            const sourceA = schema.knowledgeSources.find((s) => s.sourceId === a.sourceId);
            const sourceB = schema.knowledgeSources.find((s) => s.sourceId === b.sourceId);
            return (sourceB?.priority ?? 0) - (sourceA?.priority ?? 0);
        });
        return sorted.slice(0, maxResults);
    }
    computeRelevance(query, content, strategy) {
        switch (strategy.strategy) {
            case "exact":
                return content.toLowerCase().includes(query.toLowerCase()) ? 1.0 : 0.0;
            case "keyword": {
                const queryTerms = query.toLowerCase().split(/\s+/);
                const contentLower = content.toLowerCase();
                const matches = queryTerms.filter((term) => contentLower.includes(term)).length;
                return matches / queryTerms.length;
            }
            case "semantic":
            case "hybrid":
            default: {
                const queryTerms = query.toLowerCase().split(/\s+/);
                const contentLower = content.toLowerCase();
                const exactMatches = queryTerms.filter((term) => contentLower.includes(term)).length;
                const baseScore = exactMatches / queryTerms.length;
                return strategy.strategy === "hybrid" ? baseScore * 0.7 + 0.3 : baseScore;
            }
        }
    }
    resolveWinner(resolution, values) {
        if (values.length === 0) {
            return null;
        }
        switch (resolution) {
            case "latest_wins":
                const sorted = [...values].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                return sorted[0] ? { value: sorted[0].value, source: sorted[0].source } : null;
            case "trust_priority":
            case "human_review":
            default:
                return values[0] ? { value: values[0].value, source: values[0].source } : null;
        }
    }
    findSourcesForKey(schema, key) {
        return schema.knowledgeSources.filter((s) => s.type !== "structured_kb");
    }
    getSourceContent(sourceId) {
        const sourceMap = this.sourceContent.get(sourceId);
        return sourceMap?.get("content") ?? null;
    }
    storeSourceContent(sourceId, content) {
        let sourceMap = this.sourceContent.get(sourceId);
        if (!sourceMap) {
            sourceMap = new Map();
            this.sourceContent.set(sourceId, sourceMap);
        }
        sourceMap.set("content", content);
        this.updateSourceTimestamp(sourceId);
    }
    getSourceTimestamp(sourceId) {
        const sourceMap = this.sourceTimestamps.get(sourceId);
        return sourceMap?.get("lastUpdate") ?? nowIso();
    }
    updateSourceTimestamp(sourceId) {
        let sourceMap = this.sourceTimestamps.get(sourceId);
        if (!sourceMap) {
            sourceMap = new Map();
            this.sourceTimestamps.set(sourceId, sourceMap);
        }
        sourceMap.set("lastUpdate", nowIso());
    }
    defaultStrategy() {
        return {
            strategy: "semantic",
            maxResults: 10,
            minRelevanceScore: 0.7,
            rerankEnabled: false,
        };
    }
    defaultFreshnessPolicy() {
        return {
            maxStalenessHours: 24,
            refreshTrigger: "scheduled",
            backgroundRefreshEnabled: true,
        };
    }
    requireSchema(domainId) {
        const schema = this.schemas.get(domainId);
        if (!schema) {
            throw new Error(`domain_knowledge.schema_not_found:${domainId}`);
        }
        return schema;
    }
}
//# sourceMappingURL=domain-knowledge-schema-service.js.map