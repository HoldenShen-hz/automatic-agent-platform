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
import {
  type DomainKnowledgeSchema,
  type KnowledgeSource,
  type RetrievalStrategy,
  type FreshnessPolicy,
} from "./knowledge-schema/index.js";

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
    readonly values: readonly { value: unknown; source: string; timestamp: string }[];
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

export interface DomainKnowledgeSchemaServiceOptions {
  readonly maxSchemas?: number;
}

export class DomainKnowledgeSchemaService {
  private readonly schemas = new Map<string, DomainKnowledgeSchema>();
  private readonly sourceContent = new Map<string, Map<string, string>>();
  private readonly sourceTimestamps = new Map<string, Map<string, string>>();
  private readonly maxSchemas: number;

  public constructor(options: DomainKnowledgeSchemaServiceOptions = {}) {
    this.maxSchemas = Math.max(1, Math.trunc(options.maxSchemas ?? 256));
  }

  public register(schema: DomainKnowledgeSchema): void {
    this.removeSchemaSources(this.schemas.get(schema.domainId));
    this.schemas.delete(schema.domainId);
    this.schemas.set(schema.domainId, schema);
    this.initializeSources(schema);
    this.evictOldestSchemaIfNeeded();
  }

  public getSchema(domainId: string): DomainKnowledgeSchema | null {
    return this.schemas.get(domainId) ?? null;
  }

  public retrieve(query: KnowledgeQuery): KnowledgeRetrievalResult {
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

  public resolveConflicts(
    domainId: string,
    namespaceId: string,
    entries: Record<string, unknown>,
  ): ConflictResolutionResult {
    const schema = this.requireSchema(domainId);
    const conflicts: {
      key: string;
      values: readonly { value: unknown; source: string; timestamp: string }[];
    }[] = [];
    const resolved: {
      key: string;
      value: unknown;
      source: string;
      resolvedAt: string;
    }[] = [];

    const grouped = new Map<string, { value: unknown; source: string; timestamp: string }[]>();

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

  public checkFreshness(domainId: string): FreshnessCheckResult {
    const schema = this.requireSchema(domainId);
    const freshnessPolicy = schema.freshnessPolicy ?? this.defaultFreshnessPolicy();
    const maxStalenessHours = freshnessPolicy.maxStalenessHours;

    let oldestTimestamp: string | null = null;
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

  public refreshSource(domainId: string, sourceId: string, content: string): KnowledgeSource | null {
    const schema = this.requireSchema(domainId);
    const source = schema.knowledgeSources.find((s) => s.sourceId === sourceId);
    if (!source) {
      return null;
    }

    this.storeSourceContent(sourceId, content);
    return source;
  }

  public addSource(domainId: string, source: KnowledgeSource): KnowledgeSource | null {
    const schema = this.requireSchema(domainId);
    if (schema.knowledgeSources.some((s) => s.sourceId === source.sourceId)) {
      return null;
    }

    const updated: DomainKnowledgeSchema = {
      ...schema,
      knowledgeSources: [...schema.knowledgeSources, source],
    };
    this.schemas.delete(domainId);
    this.schemas.set(domainId, updated);
    this.initializeSources(updated);
    return source;
  }

  public removeSource(domainId: string, sourceId: string): boolean {
    const schema = this.requireSchema(domainId);
    const index = schema.knowledgeSources.findIndex((s) => s.sourceId === sourceId);
    if (index === -1) {
      return false;
    }

    const updated: DomainKnowledgeSchema = {
      ...schema,
      knowledgeSources: [
        ...schema.knowledgeSources.slice(0, index),
        ...schema.knowledgeSources.slice(index + 1),
      ],
    };
    this.sourceContent.delete(sourceId);
    this.sourceTimestamps.delete(sourceId);
    this.schemas.delete(domainId);
    this.schemas.set(domainId, updated);
    return true;
  }

  private initializeSources(schema: DomainKnowledgeSchema): void {
    for (const source of schema.knowledgeSources) {
      this.sourceTimestamps.set(source.sourceId, new Map());
    }
  }

  private removeSchemaSources(schema: DomainKnowledgeSchema | undefined): void {
    for (const source of schema?.knowledgeSources ?? []) {
      this.sourceContent.delete(source.sourceId);
      this.sourceTimestamps.delete(source.sourceId);
    }
  }

  private executeRetrieval(
    schema: DomainKnowledgeSchema,
    query: KnowledgeQuery,
    strategy: RetrievalStrategy,
    maxResults: number,
    minScore: number,
  ): readonly KnowledgeResult[] {
    const results: KnowledgeResult[] = [];
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

  private computeRelevance(query: string, content: string, strategy: RetrievalStrategy): number {
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

  private resolveWinner(
    resolution: DomainKnowledgeSchema["conflictResolution"],
    values: readonly { value: unknown; source: string; timestamp: string }[],
  ): { value: unknown; source: string } | null {
    if (values.length === 0) {
      return null;
    }

    switch (resolution) {
      case "latest_wins":
        const sorted = [...values].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        return sorted[0] ? { value: sorted[0].value, source: sorted[0].source } : null;
      case "trust_priority":
      case "human_review":
      default:
        return values[0] ? { value: values[0].value, source: values[0].source } : null;
    }
  }

  private findSourcesForKey(schema: DomainKnowledgeSchema, key: string): KnowledgeSource[] {
    return schema.knowledgeSources.filter((s) => s.type !== "structured_kb");
  }

  private getSourceContent(sourceId: string): string | null {
    const sourceMap = this.sourceContent.get(sourceId);
    return sourceMap?.get("content") ?? null;
  }

  private storeSourceContent(sourceId: string, content: string): void {
    let sourceMap = this.sourceContent.get(sourceId);
    if (!sourceMap) {
      sourceMap = new Map();
      this.sourceContent.set(sourceId, sourceMap);
    }
    sourceMap.set("content", content);
    this.updateSourceTimestamp(sourceId);
  }

  private getSourceTimestamp(sourceId: string): string {
    const sourceMap = this.sourceTimestamps.get(sourceId);
    return sourceMap?.get("lastUpdate") ?? nowIso();
  }

  private updateSourceTimestamp(sourceId: string): void {
    let sourceMap = this.sourceTimestamps.get(sourceId);
    if (!sourceMap) {
      sourceMap = new Map();
      this.sourceTimestamps.set(sourceId, sourceMap);
    }
    sourceMap.set("lastUpdate", nowIso());
  }

  private evictOldestSchemaIfNeeded(): void {
    while (this.schemas.size > this.maxSchemas) {
      const oldestDomainId = this.schemas.keys().next().value;
      if (oldestDomainId === undefined) {
        return;
      }
      const evictedSchema = this.schemas.get(oldestDomainId);
      this.schemas.delete(oldestDomainId);
      this.removeSchemaSources(evictedSchema);
    }
  }

  private defaultStrategy(): RetrievalStrategy {
    return {
      strategy: "semantic",
      maxResults: 10,
      minRelevanceScore: 0.7,
      rerankEnabled: false,
    };
  }

  private defaultFreshnessPolicy(): FreshnessPolicy {
    return {
      maxStalenessHours: 24,
      refreshTrigger: "scheduled",
      backgroundRefreshEnabled: true,
    };
  }

  private requireSchema(domainId: string): DomainKnowledgeSchema {
    const schema = this.schemas.get(domainId);
    if (!schema) {
      throw new Error(`domain_knowledge.schema_not_found:${domainId}`);
    }
    return schema;
  }
}
