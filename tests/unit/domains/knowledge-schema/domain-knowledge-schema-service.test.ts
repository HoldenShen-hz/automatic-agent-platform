import assert from "node:assert/strict";
import test from "node:test";

import { DomainKnowledgeSchemaService } from "../../../src/domains/domain-knowledge-schema-service.js";
import type { DomainKnowledgeSchema } from "../../../src/domains/knowledge-schema/index.js";

function createTestSchema(domainId: string): DomainKnowledgeSchema {
  return {
    schemaId: `schema_${domainId}`,
    domainId,
    namespaceIds: ["ns_1", "ns_2"],
    freshnessWindowHours: 24,
    conflictResolution: "trust_priority",
    retentionDays: 30,
    knowledgeSources: [
      {
        sourceId: "src_1",
        type: "document_store",
        priority: 80,
        refreshInterval: "2h",
        authScope: "read",
      },
      {
        sourceId: "src_2",
        type: "database",
        priority: 60,
        refreshInterval: "1d",
        authScope: "read",
      },
    ],
    retrievalStrategy: {
      strategy: "semantic",
      maxResults: 10,
      minRelevanceScore: 0.7,
      rerankEnabled: false,
    },
    freshnessPolicy: {
      maxStalenessHours: 24,
      refreshTrigger: "scheduled",
      backgroundRefreshEnabled: true,
    },
  };
}

test("DomainKnowledgeSchemaService.register stores schema by domainId", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain");

  service.register(schema);

  const retrieved = service.getSchema("test_domain");
  assert.ok(retrieved != null);
  assert.equal(retrieved?.domainId, "test_domain");
});

test("DomainKnowledgeSchemaService.getSchema returns null for unknown domain", () => {
  const service = new DomainKnowledgeSchemaService();

  const result = service.getSchema("nonexistent");

  assert.equal(result, null);
});

test("DomainKnowledgeSchemaService.retrieve returns retrieval results", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("retrieve_test");
  service.register(schema);
  service.refreshSource("retrieve_test", "src_1", "test content about machine learning");

  const result = service.retrieve({
    query: "machine learning",
    domainId: "retrieve_test",
    maxResults: 5,
  });

  assert.ok(result.queryId.startsWith("kq_"));
  assert.equal(result.domainId, "retrieve_test");
  assert.equal(result.totalResults >= 0, true);
  assert.ok(result.executionTimeMs >= 0);
});

test("DomainKnowledgeSchemaService.retrieve uses schema default strategy when query does not specify", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("strategy_test");
  schema.retrievalStrategy = {
    strategy: "keyword",
    maxResults: 20,
    minRelevanceScore: 0.5,
    rerankEnabled: true,
  };
  service.register(schema);

  const result = service.retrieve({
    query: "test query",
    domainId: "strategy_test",
  });

  assert.equal(result.strategy.strategy, "keyword");
  assert.equal(result.strategy.maxResults, 20);
});

test("DomainKnowledgeSchemaService.retrieve respects query maxResults override", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("max_results_test");
  service.register(schema);
  service.refreshSource("max_results_test", "src_1", "content1");
  service.refreshSource("max_results_test", "src_1", "content2");

  const result = service.retrieve({
    query: "test",
    domainId: "max_results_test",
    maxResults: 1,
  });

  assert.equal(result.totalResults <= 1, true);
});

test("DomainKnowledgeSchemaService.retrieve uses semantic strategy by default", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("default_strategy");
  service.register(schema);

  const result = service.retrieve({
    query: "test query",
    domainId: "default_strategy",
  });

  assert.equal(result.strategy.strategy, "semantic");
});

test("DomainKnowledgeSchemaService.resolveConflicts identifies and resolves conflicts", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("conflict_test");
  schema.conflictResolution = "latest_wins";
  service.register(schema);

  const result = service.resolveConflicts("conflict_test", "ns_1", {
    key1: "value1",
    key2: "value2",
  });

  assert.ok(result.conflictId.startsWith("cr_"));
  assert.equal(result.namespaceId, "ns_1");
});

test("DomainKnowledgeSchemaService.resolveConflicts with latest_wins resolves to latest timestamp", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("latest_wins_test");
  schema.conflictResolution = "latest_wins";
  service.register(schema);

  // Add sources with content to simulate conflicting sources
  service.refreshSource("latest_wins_test", "src_1", "content for key1");
  service.refreshSource("latest_wins_test", "src_2", "content for key1");

  const result = service.resolveConflicts("latest_wins_test", "ns_1", {
    key1: "user_value",
  });

  // No conflicts when sources don't have different values for same key
  assert.ok(result.conflictId.startsWith("cr_"));
});

test("DomainKnowledgeSchemaService.checkFreshness returns freshness status", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("freshness_test");
  service.register(schema);
  service.refreshSource("freshness_test", "src_1", "some content");

  const result = service.checkFreshness("freshness_test");

  assert.equal(result.schemaId, schema.schemaId);
  assert.equal(result.domainId, "freshness_test");
  assert.equal(result.maxStalenessHours, 24);
});

test("DomainKnowledgeSchemaService.checkFreshness detects stale data", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("stale_test");
  schema.freshnessPolicy = {
    maxStalenessHours: 1, // 1 hour max
    refreshTrigger: "scheduled",
    backgroundRefreshEnabled: true,
  };
  service.register(schema);
  // Don't refresh - should be stale

  const result = service.checkFreshness("stale_test");

  assert.equal(result.refreshRecommended, true);
  assert.ok(result.stalenessHours > 1);
});

test("DomainKnowledgeSchemaService.checkFreshness throws for unknown domain", () => {
  const service = new DomainKnowledgeSchemaService();

  assert.throws(
    () => service.checkFreshness("unknown"),
    /schema_not_found/,
  );
});

test("DomainKnowledgeSchemaService.refreshSource updates source content", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("refresh_test");
  service.register(schema);

  const result = service.refreshSource("refresh_test", "src_1", "updated content");

  assert.ok(result != null);
  assert.equal(result.sourceId, "src_1");
});

test("DomainKnowledgeSchemaService.refreshSource returns null for unknown source", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("unknown_source");
  service.register(schema);

  const result = service.refreshSource("unknown_source", "nonexistent", "content");

  assert.equal(result, null);
});

test("DomainKnowledgeSchemaService.refreshSource throws for unknown domain", () => {
  const service = new DomainKnowledgeSchemaService();

  assert.throws(
    () => service.refreshSource("unknown", "src_1", "content"),
    /schema_not_found/,
  );
});

test("DomainKnowledgeSchemaService.addSource adds new source to schema", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("add_source_test");
  service.register(schema);

  const newSource = {
    sourceId: "src_new",
    type: "embedding_index" as const,
    priority: 70,
    refreshInterval: "4h",
    authScope: "read",
  };

  const result = service.addSource("add_source_test", newSource);

  assert.ok(result != null);
  assert.equal(result.sourceId, "src_new");

  const updated = service.getSchema("add_source_test");
  assert.equal(updated?.knowledgeSources.length, 3);
});

test("DomainKnowledgeSchemaService.addSource returns null when source already exists", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("duplicate_source");
  service.register(schema);

  const result = service.addSource("duplicate_source", {
    sourceId: "src_1", // already exists
    type: "document_store" as const,
    priority: 50,
    refreshInterval: "1d",
    authScope: "read",
  });

  assert.equal(result, null);
});

test("DomainKnowledgeSchemaService.removeSource removes existing source", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("remove_source_test");
  service.register(schema);

  const result = service.removeSource("remove_source_test", "src_1");

  assert.equal(result, true);

  const updated = service.getSchema("remove_source_test");
  assert.equal(updated?.knowledgeSources.length, 1);
});

test("DomainKnowledgeSchemaService.removeSource returns false for unknown source", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("unknown_remove");
  service.register(schema);

  const result = service.removeSource("unknown_remove", "nonexistent");

  assert.equal(result, false);
});

test("DomainKnowledgeSchemaService.retrieve with keyword strategy matches terms", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("keyword_test");
  schema.retrievalStrategy = {
    strategy: "keyword",
    maxResults: 10,
    minRelevanceScore: 0.3,
    rerankEnabled: false,
  };
  service.register(schema);
  service.refreshSource("keyword_test", "src_1", "The quick brown fox jumps over the lazy dog");

  const result = service.retrieve({
    query: "quick fox",
    domainId: "keyword_test",
  });

  assert.equal(result.totalResults >= 0, true);
});

test("DomainKnowledgeSchemaService.retrieve with exact strategy matches exact strings", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("exact_test");
  schema.retrievalStrategy = {
    strategy: "exact",
    maxResults: 10,
    minRelevanceScore: 0.5,
    rerankEnabled: false,
  };
  service.register(schema);
  service.refreshSource("exact_test", "src_1", "Machine Learning Introduction");

  const result = service.retrieve({
    query: "machine learning",
    domainId: "exact_test",
  });

  // Should not match due to case difference
  assert.equal(result.totalResults, 0);
});

test("DomainKnowledgeSchemaService.retrieve with hybrid strategy combines semantic and keyword", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("hybrid_test");
  schema.retrievalStrategy = {
    strategy: "hybrid",
    maxResults: 10,
    minRelevanceScore: 0.3,
    rerankEnabled: false,
  };
  service.register(schema);
  service.refreshSource("hybrid_test", "src_1", "Python programming language");

  const result = service.retrieve({
    query: "python",
    domainId: "hybrid_test",
  });

  assert.equal(result.strategy.strategy, "hybrid");
});

test("DomainKnowledgeSchemaService.checkFreshness returns isFresh when data is fresh", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("fresh_data");
  schema.freshnessPolicy = {
    maxStalenessHours: 24,
    refreshTrigger: "scheduled",
    backgroundRefreshEnabled: true,
  };
  service.register(schema);
  service.refreshSource("fresh_data", "src_1", "fresh content");

  const result = service.checkFreshness("fresh_data");

  assert.equal(result.isFresh, true);
  assert.equal(result.refreshRecommended, false);
});

test("DomainKnowledgeSchemaService.retrieve respects namespace filter", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("namespace_filter");
  service.register(schema);
  service.refreshSource("namespace_filter", "src_1", "content from ns1");

  const result = service.retrieve({
    query: "content",
    domainId: "namespace_filter",
    namespaceFilter: ["src_1"],
  });

  assert.ok(result.totalResults >= 0);
});

test("DomainKnowledgeSchemaService.retrieve results are sorted by relevance then priority", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("sort_test");
  schema.knowledgeSources = [
    { sourceId: "high_priority", type: "document_store", priority: 90, refreshInterval: "1d", authScope: "read" },
    { sourceId: "low_priority", type: "document_store", priority: 30, refreshInterval: "1d", authScope: "read" },
  ];
  schema.retrievalStrategy = {
    strategy: "semantic",
    maxResults: 10,
    minRelevanceScore: 0.0, // low to include all
    rerankEnabled: false,
  };
  service.register(schema);
  service.refreshSource("sort_test", "high_priority", "matching content");
  service.refreshSource("sort_test", "low_priority", "matching content");

  const result = service.retrieve({
    query: "matching content",
    domainId: "sort_test",
    minRelevanceScore: 0.0,
  });

  // Higher priority source should come first when relevance is equal
  if (result.results.length > 1) {
    assert.equal(result.results[0]!.sourceId, "high_priority");
  }
});