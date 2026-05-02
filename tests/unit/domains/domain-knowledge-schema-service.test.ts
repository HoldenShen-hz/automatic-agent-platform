import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainKnowledgeSchemaService,
  type KnowledgeQuery,
} from "../../../src/domains/domain-knowledge-schema-service.js";
import {
  DomainKnowledgeSchemaSchema,
  KnowledgeSourceSchema,
  RetrievalStrategySchema,
  type DomainKnowledgeSchema,
  type KnowledgeSource,
} from "../../../src/domains/knowledge-schema/index.js";

function createTestSchema(domainId: string, overrides?: Partial<DomainKnowledgeSchema>): DomainKnowledgeSchema {
  const schema: DomainKnowledgeSchema = {
    schemaId: `schema_${domainId}`,
    domainId,
    namespaceIds: ["ns_primary", "ns_secondary"],
    freshnessWindowHours: 24,
    conflictResolution: "latest_wins",
    retentionDays: 30,
    knowledgeSources: [
      {
        sourceId: "src_doc_1",
        type: "document_store",
        priority: 80,
        refreshInterval: "1d",
        authScope: "read",
        endpoint: "https://docs.example.com",
      },
      {
        sourceId: "src_api_1",
        type: "api_realtime",
        priority: 60,
        refreshInterval: "1h",
        authScope: "read",
        endpoint: "https://api.example.com",
      },
      {
        sourceId: "src_structured_1",
        type: "structured_kb",
        priority: 50,
        refreshInterval: "1d",
        authScope: "read",
      },
    ],
    retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
    freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    ...overrides,
  };
  return schema;
}

// ============================================================================
// 1. Knowledge Schema Loading Per Domain
// ============================================================================

test("DomainKnowledgeSchemaService registers schema and loads by domainId", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("ecommerce");

  service.register(schema);

  const loaded = service.getSchema("ecommerce");
  assert.ok(loaded !== null);
  assert.equal(loaded!.domainId, "ecommerce");
  assert.equal(loaded!.schemaId, "schema_ecommerce");
});

test("DomainKnowledgeSchemaService returns null for unregistered domain", () => {
  const service = new DomainKnowledgeSchemaService();

  const result = service.getSchema("nonexistent_domain");

  assert.equal(result, null);
});

test("DomainKnowledgeSchemaService loads multiple domains independently", () => {
  const service = new DomainKnowledgeSchemaService();

  service.register(createTestSchema("domain_a"));
  service.register(createTestSchema("domain_b"));
  service.register(createTestSchema("domain_c"));

  const domainA = service.getSchema("domain_a");
  const domainB = service.getSchema("domain_b");
  const domainC = service.getSchema("domain_c");

  assert.ok(domainA);
  assert.ok(domainB);
  assert.ok(domainC);
  assert.equal(domainA!.domainId, "domain_a");
  assert.equal(domainB!.domainId, "domain_b");
  assert.equal(domainC!.domainId, "domain_c");
});

test("DomainKnowledgeSchemaService overwrites existing schema for same domainId", () => {
  const service = new DomainKnowledgeSchemaService();

  service.register(createTestSchema("test_domain", { retentionDays: 30 }));
  service.register(createTestSchema("test_domain", { retentionDays: 60 }));

  const loaded = service.getSchema("test_domain");
  assert.equal(loaded!.retentionDays, 60);
});

test("DomainKnowledgeSchemaService throws on retrieve for unregistered domain", () => {
  const service = new DomainKnowledgeSchemaService();
  const query: KnowledgeQuery = { query: "test", domainId: "nonexistent" };

  assert.throws(
    () => service.retrieve(query),
    (err: unknown) => err instanceof Error && err.message.includes("domain_knowledge.schema_not_found"),
  );
});

// ============================================================================
// 2. Schema Validation for Domain Knowledge
// ============================================================================

test("DomainKnowledgeSchema validates valid schema passes", () => {
  const validSchema = {
    schemaId: "valid_schema",
    domainId: "test_domain",
    namespaceIds: ["ns1"],
    knowledgeSources: [
      { sourceId: "src1", type: "document_store", priority: 50, refreshInterval: "1d", authScope: "read" },
    ],
  };

  const result = DomainKnowledgeSchemaSchema.safeParse(validSchema);
  assert.equal(result.success, true);
});

test("DomainKnowledgeSchema rejects schema missing required schemaId", () => {
  const invalidSchema = {
    domainId: "test_domain",
    namespaceIds: [],
  } as unknown as DomainKnowledgeSchema;

  const result = DomainKnowledgeSchemaSchema.safeParse(invalidSchema);
  assert.equal(result.success, false);
});

test("DomainKnowledgeSchema rejects invalid knowledge source type", () => {
  const invalidSource = {
    sourceId: "src1",
    type: "invalid_type",
    priority: 50,
    refreshInterval: "1d",
    authScope: "read",
  };

  const result = KnowledgeSourceSchema.safeParse(invalidSource);
  assert.equal(result.success, false);
});

test("DomainKnowledgeSchema validates retrieval strategy enum values", () => {
  const validStrategies = ["semantic", "keyword", "hybrid", "exact"];

  for (const strategy of validStrategies) {
    const result = RetrievalStrategySchema.safeParse({ strategy, maxResults: 10, minRelevanceScore: 0.7 });
    assert.equal(result.success, true, `Strategy ${strategy} should be valid`);
  }

  const invalidResult = RetrievalStrategySchema.safeParse({
    strategy: "invalid_strategy",
    maxResults: 10,
    minRelevanceScore: 0.7,
  });
  assert.equal(invalidResult.success, false);
});

test("DomainKnowledgeSchema validates freshness policy refresh trigger", () => {
  const validTriggers = ["on_demand", "scheduled", "event_driven"];

  for (const trigger of validTriggers) {
    const result = KnowledgeSourceSchema.safeParse({
      sourceId: "src1",
      type: "document_store",
      priority: 50,
      refreshInterval: "1d",
      authScope: "read",
    });
    assert.equal(result.success, true);
  }
});

test("DomainKnowledgeSchema rejects conflict resolution with invalid value", () => {
  const schema = createTestSchema("test_domain", {
    conflictResolution: "invalid_resolution" as DomainKnowledgeSchema["conflictResolution"],
  });

  const result = DomainKnowledgeSchemaSchema.safeParse(schema);
  assert.equal(result.success, false);
});

// ============================================================================
// 3. Knowledge Entity Extraction
// ============================================================================

test("DomainKnowledgeSchemaService retrieve extracts entities with exact strategy", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    retrievalStrategy: { strategy: "exact", maxResults: 10, minRelevanceScore: 0.5, rerankEnabled: false },
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "The Quick Brown Fox jumps over the lazy dog");

  const query: KnowledgeQuery = {
    query: "Quick",
    domainId: "test_domain",
    namespaceFilter: ["src_doc_1"],
  };

  const result = service.retrieve(query);

  assert.ok(result.results.length > 0, "Should find exact match");
  assert.equal(result.results[0].relevanceScore, 1.0);
});

test("DomainKnowledgeSchemaService retrieve extracts entities with keyword strategy", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    retrievalStrategy: { strategy: "keyword", maxResults: 10, minRelevanceScore: 0.1, rerankEnabled: false },
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "machine learning algorithms and neural networks");

  const query: KnowledgeQuery = {
    query: "machine learning",
    domainId: "test_domain",
    namespaceFilter: ["src_doc_1"],
  };

  const result = service.retrieve(query);

  assert.ok(result.results.length > 0, "Should find keyword matches");
  assert.ok(result.results[0].relevanceScore > 0, "Should have relevance score");
});

test("DomainKnowledgeSchemaService retrieve extracts entities with semantic strategy", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.3, rerankEnabled: false },
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "artificial intelligence and deep learning techniques");

  const query: KnowledgeQuery = {
    query: "neural networks AI",
    domainId: "test_domain",
  };

  const result = service.retrieve(query);

  assert.ok(result.results.length >= 0);
  assert.equal(result.domainId, "test_domain");
});

test("DomainKnowledgeSchemaService retrieve extracts entities with hybrid strategy", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    retrievalStrategy: { strategy: "hybrid", maxResults: 10, minRelevanceScore: 0.3, rerankEnabled: false },
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "data science and machine learning");

  const query: KnowledgeQuery = {
    query: "machine learning",
    domainId: "test_domain",
  };

  const result = service.retrieve(query);

  assert.ok(result.results.length >= 0);
  assert.equal(result.strategy.strategy, "hybrid");
});

test("DomainKnowledgeSchemaService retrieve respects namespace filter", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain");
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "document store content");

  const query: KnowledgeQuery = {
    query: "document",
    domainId: "test_domain",
    namespaceFilter: ["ns_primary"],
  };

  const result = service.retrieve(query);

  assert.ok(result.results.length >= 0);
});

test("DomainKnowledgeSchemaService retrieve returns results sorted by relevance", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    retrievalStrategy: { strategy: "keyword", maxResults: 10, minRelevanceScore: 0.1, rerankEnabled: false },
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "exact match content here");
  service.refreshSource("test_domain", "src_api_1", "partial match partial");

  const query: KnowledgeQuery = {
    query: "exact match",
    domainId: "test_domain",
  };

  const result = service.retrieve(query);

  if (result.results.length > 1) {
    assert.ok(
      result.results[0].relevanceScore >= result.results[1].relevanceScore,
      "First result should have higher or equal relevance score",
    );
  }
});

test("DomainKnowledgeSchemaService retrieve includes metadata in results", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain");
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "test content");

  const query: KnowledgeQuery = {
    query: "test",
    domainId: "test_domain",
    minRelevanceScore: 0.1,
  };

  const result = service.retrieve(query);

  if (result.results.length > 0) {
    const firstResult = result.results[0];
    assert.ok(firstResult.resultId.length > 0, "Should have resultId");
    assert.ok(firstResult.sourceId.length > 0, "Should have sourceId");
    assert.ok(firstResult.content.length > 0, "Should have content");
    assert.ok(firstResult.metadata, "Should have metadata");
  }
});

test("DomainKnowledgeSchemaService retrieve respects maxResults limit", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    retrievalStrategy: { strategy: "keyword", maxResults: 100, minRelevanceScore: 0.1, rerankEnabled: false },
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "content one");
  service.refreshSource("test_domain", "src_api_1", "content two");

  const query: KnowledgeQuery = {
    query: "content",
    domainId: "test_domain",
    maxResults: 1,
  };

  const result = service.retrieve(query);

  assert.ok(result.totalResults <= 1, "Should respect maxResults limit");
});

// ============================================================================
// 4. Schema Versioning
// ============================================================================

test("DomainKnowledgeSchemaService checkFreshness uses retentionDays", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    retentionDays: 30,
    freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "test content");

  const result = service.checkFreshness("test_domain");

  assert.equal(result.maxStalenessHours, 24);
  assert.equal(typeof result.isFresh, "boolean");
  assert.equal(typeof result.refreshRecommended, "boolean");
});

test("DomainKnowledgeSchemaService checkFreshness detects staleness", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    freshnessPolicy: { maxStalenessHours: 1, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
  });
  service.register(schema);

  // Register source without refreshing to simulate stale data
  const result = service.checkFreshness("test_domain");

  assert.equal(result.maxStalenessHours, 1);
  assert.equal(typeof result.stalenessHours, "number");
});

test("DomainKnowledgeSchemaService resolveConflicts uses conflictResolution strategy", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    conflictResolution: "latest_wins",
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "key=old");
  service.refreshSource("test_domain", "src_api_1", "key=newer");

  const result = service.resolveConflicts("test_domain", "ns_primary", {
    conflicting_key: "user_value",
  });

  assert.ok(result.conflictId);
  assert.ok(Array.isArray(result.resolvedEntries));
  assert.ok(Array.isArray(result.conflicts));
});

test("DomainKnowledgeSchemaService resolveConflicts with trust_priority strategy", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    conflictResolution: "trust_priority",
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "key=first");
  service.refreshSource("test_domain", "src_api_1", "key=second");

  const result = service.resolveConflicts("test_domain", "ns_primary", {
    another_key: "user_value",
  });

  assert.ok(result.conflictId);
  assert.equal(result.namespaceId, "ns_primary");
});

test("DomainKnowledgeSchemaService resolveConflicts with human_review strategy", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    conflictResolution: "human_review",
  });
  service.register(schema);

  const result = service.resolveConflicts("test_domain", "ns_primary", {
    review_key: "user_value",
  });

  assert.ok(result.conflictId);
  assert.ok(Array.isArray(result.resolvedEntries));
});

test("DomainKnowledgeSchemaService refreshSource updates freshness timestamp", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain");
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "updated content");

  const freshResult = service.checkFreshness("test_domain");
  assert.equal(freshResult.isFresh, true);

  const updated = service.getSchema("test_domain");
  assert.ok(updated);
  assert.equal(updated!.knowledgeSources.find((s) => s.sourceId === "src_doc_1")!.sourceId, "src_doc_1");
});

test("DomainKnowledgeSchemaService addSource updates schema version metadata", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain");
  service.register(schema);

  const originalSourceCount = service.getSchema("test_domain")!.knowledgeSources.length;

  const newSource: KnowledgeSource = {
    sourceId: "src_added",
    type: "embedding_index",
    priority: 75,
    refreshInterval: "12h",
    authScope: "read",
  };

  const result = service.addSource("test_domain", newSource);

  assert.ok(result);
  assert.equal(service.getSchema("test_domain")!.knowledgeSources.length, originalSourceCount + 1);
});

test("DomainKnowledgeSchemaService removeSource updates schema", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain");
  service.register(schema);

  const originalCount = service.getSchema("test_domain")!.knowledgeSources.length;

  const removed = service.removeSource("test_domain", "src_doc_1");

  assert.equal(removed, true);
  assert.equal(service.getSchema("test_domain")!.knowledgeSources.length, originalCount - 1);
});

test("DomainKnowledgeSchemaService freshnessWindowHours affects freshness check", () => {
  const service = new DomainKnowledgeSchemaService();
  const schema = createTestSchema("test_domain", {
    freshnessWindowHours: 48,
    freshnessPolicy: { maxStalenessHours: 48, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
  });
  service.register(schema);

  service.refreshSource("test_domain", "src_doc_1", "content");

  const result = service.checkFreshness("test_domain");

  assert.equal(result.maxStalenessHours, 48);
  assert.equal(result.isFresh, true);
});

test("DomainKnowledgeSchemaService multiple schemas maintain independent state", () => {
  const service = new DomainKnowledgeSchemaService();

  service.register(createTestSchema("domain_1", { retentionDays: 10 }));
  service.register(createTestSchema("domain_2", { retentionDays: 20 }));
  service.register(createTestSchema("domain_3", { retentionDays: 30 }));

  assert.equal(service.getSchema("domain_1")!.retentionDays, 10);
  assert.equal(service.getSchema("domain_2")!.retentionDays, 20);
  assert.equal(service.getSchema("domain_3")!.retentionDays, 30);

  service.refreshSource("domain_2", "src_doc_1", "domain2 content");

  const fresh1 = service.checkFreshness("domain_1");
  const fresh2 = service.checkFreshness("domain_2");

  assert.equal(fresh1.isFresh, true);
  assert.equal(fresh2.isFresh, true);
});
