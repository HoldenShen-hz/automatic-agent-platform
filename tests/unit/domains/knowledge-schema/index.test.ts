import assert from "node:assert/strict";
import test from "node:test";

import {
  KnowledgeSourceSchema,
  RetrievalStrategySchema,
  FreshnessPolicySchema,
  DomainKnowledgeSchemaSchema,
  resolveKnowledgeNamespaces,
  type DomainKnowledgeSchema,
} from "../../../../src/domains/knowledge-schema/index.js";
import { DomainKnowledgeSchemaSchema as DomainKnowledgeSchemaSchemaActual } from "../../../../src/domains/knowledge-schema/index.js";

test("KnowledgeSourceSchema accepts valid source types", () => {
  const validTypes = ["document_store", "api_realtime", "database", "embedding_index", "structured_kb"];
  for (const type of validTypes) {
    const result = KnowledgeSourceSchema.safeParse({
      sourceId: "src_1",
      type,
      priority: 50,
      refreshInterval: "1d",
      authScope: "read",
    });
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("KnowledgeSourceSchema applies defaults", () => {
  const result = KnowledgeSourceSchema.parse({
    sourceId: "src_1",
    type: "document_store",
    authScope: "read",
  });
  assert.equal(result.priority, 50);
  assert.equal(result.refreshInterval, "1d");
});

test("RetrievalStrategySchema applies defaults", () => {
  const result = RetrievalStrategySchema.parse({});
  assert.equal(result.strategy, "semantic");
  assert.equal(result.maxResults, 10);
  assert.equal(result.minRelevanceScore, 0.7);
  assert.equal(result.rerankEnabled, false);
});

test("RetrievalStrategySchema accepts valid strategies", () => {
  const strategies = ["semantic", "keyword", "hybrid", "exact"];
  for (const strategy of strategies) {
    const result = RetrievalStrategySchema.safeParse({ strategy });
    assert.equal(result.success, true, `Expected ${strategy} to be valid`);
  }
});

test("FreshnessPolicySchema applies defaults", () => {
  const result = FreshnessPolicySchema.parse({});
  assert.equal(result.maxStalenessHours, 24);
  assert.equal(result.refreshTrigger, "scheduled");
  assert.equal(result.backgroundRefreshEnabled, true);
});

test("FreshnessPolicySchema accepts valid triggers", () => {
  const triggers = ["on_demand", "scheduled", "event_driven"];
  for (const trigger of triggers) {
    const result = FreshnessPolicySchema.safeParse({ refreshTrigger: trigger });
    assert.equal(result.success, true);
  }
});

test("DomainKnowledgeSchemaSchema applies defaults", () => {
  const result = DomainKnowledgeSchemaSchema.parse({
    schemaId: "schema_1",
    domainId: "coding",
  });
  assert.deepEqual(result.namespaceIds, []);
  assert.equal(result.freshnessWindowHours, 24);
  assert.equal(result.conflictResolution, "trust_priority");
  assert.equal(result.retentionDays, 30);
});

test("DomainKnowledgeSchemaSchema accepts full schema", () => {
  const result = DomainKnowledgeSchemaSchema.parse({
    schemaId: "schema_full",
    domainId: "coding",
    namespaceIds: ["ns_1", "ns_2"],
    freshnessWindowHours: 48,
    conflictResolution: "latest_wins",
    retentionDays: 60,
    knowledgeSources: [
      { sourceId: "src_1", type: "document_store", priority: 80, refreshInterval: "1d", authScope: "read" },
    ],
    retrievalStrategy: { strategy: "semantic", maxResults: 20, minRelevanceScore: 0.8, rerankEnabled: true },
    freshnessPolicy: { maxStalenessHours: 12, refreshTrigger: "on_demand", backgroundRefreshEnabled: false },
  });

  assert.equal(result.schemaId, "schema_full");
  assert.equal(result.conflictResolution, "latest_wins");
  assert.equal(result.knowledgeSources.length, 1);
  assert.equal(result.retrievalStrategy?.strategy, "semantic");
  assert.equal(result.freshnessPolicy?.maxStalenessHours, 12);
});

test("resolveKnowledgeNamespaces returns combined unique namespaces", () => {
  const schema: DomainKnowledgeSchema = {
    schemaId: "schema_1",
    domainId: "coding",
    namespaceIds: ["ns_a", "ns_b"],
    freshnessWindowHours: 24,
    conflictResolution: "trust_priority",
    retentionDays: 30,
    knowledgeSources: [],
    retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
    freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
  };

  const result = resolveKnowledgeNamespaces(schema);
  assert.deepEqual(result, ["ns_a", "ns_b"]);
});

test("resolveKnowledgeNamespaces merges additional namespaces", () => {
  const schema: DomainKnowledgeSchema = {
    schemaId: "schema_1",
    domainId: "coding",
    namespaceIds: ["ns_primary"],
    freshnessWindowHours: 24,
    conflictResolution: "trust_priority",
    retentionDays: 30,
    knowledgeSources: [],
    retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
    freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
  };

  const result = resolveKnowledgeNamespaces(schema, ["ns_extra", "ns_primary", "ns_other"]);
  assert.deepEqual(result, ["ns_primary", "ns_extra", "ns_other"]);
});

test("resolveKnowledgeNamespaces removes duplicates", () => {
  const schema: DomainKnowledgeSchema = {
    schemaId: "schema_1",
    domainId: "coding",
    namespaceIds: ["ns_a", "ns_a"],
    freshnessWindowHours: 24,
    conflictResolution: "trust_priority",
    retentionDays: 30,
    knowledgeSources: [],
    retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
    freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
  };

  const result = resolveKnowledgeNamespaces(schema);
  assert.deepEqual(result, ["ns_a"]);
});

test("resolveKnowledgeNamespaces handles empty schema namespace list", () => {
  const schema: DomainKnowledgeSchema = {
    schemaId: "schema_1",
    domainId: "coding",
    namespaceIds: [],
    freshnessWindowHours: 24,
    conflictResolution: "trust_priority",
    retentionDays: 30,
    knowledgeSources: [],
    retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
    freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
  };

  const result = resolveKnowledgeNamespaces(schema, ["ns_1", "ns_2"]);
  assert.deepEqual(result, ["ns_1", "ns_2"]);
});
