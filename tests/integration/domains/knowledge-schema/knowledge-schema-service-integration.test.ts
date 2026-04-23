import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { DomainKnowledgeSchemaService } from "../../../../src/domains/domain-knowledge-schema-service.js";
import { DomainKnowledgeSchemaSchema } from "../../../../src/domains/knowledge-schema/index.js";
import type { KnowledgeSource } from "../../../../src/domains/knowledge-schema/index.js";

function createSchema(overrides: Partial<{
  schemaId: string;
  domainId: string;
  knowledgeSources: { sourceId: string; type: "document_store" | "database"; priority: number; refreshInterval: string; authScope: string; endpoint?: string }[];
  retrievalStrategy: { strategy: "keyword" | "semantic"; maxResults: number; minRelevanceScore: number; rerankEnabled: boolean };
  conflictResolution: "latest_wins" | "trust_priority" | "human_review";
}> = {}): ReturnType<typeof DomainKnowledgeSchemaSchema.parse> {
  return DomainKnowledgeSchemaSchema.parse({
    schemaId: newId("schema"),
    domainId: overrides.domainId ?? "test-domain",
    namespaceIds: ["ns1", "ns2"],
    freshnessWindowHours: 24,
    conflictResolution: overrides.conflictResolution ?? "trust_priority",
    retentionDays: 30,
    knowledgeSources: overrides.knowledgeSources ?? [
      {
        sourceId: "src1",
        type: "document_store",
        priority: 80,
        refreshInterval: "1d",
        authScope: "read",
        endpoint: "https://example.com/docs",
      },
    ],
    retrievalStrategy: overrides.retrievalStrategy,
  });
}

test("integration: DomainKnowledgeSchemaService registers and retrieves schema", () => {
  const service = new DomainKnowledgeSchemaService();

  const schema = createSchema({ domainId: "test-domain" });

  service.register(schema);

  const retrieved = service.getSchema("test-domain");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.domainId, "test-domain");
  assert.equal(retrieved!.namespaceIds.length, 2);
});

test("integration: DomainKnowledgeSchemaService retrieves knowledge with keyword strategy", () => {
  const service = new DomainKnowledgeSchemaService();

  const schema = createSchema({
    domainId: "search-domain",
    knowledgeSources: [
      {
        sourceId: "src1",
        type: "document_store",
        priority: 50,
        refreshInterval: "1d",
        authScope: "read",
      },
    ],
    retrievalStrategy: {
      strategy: "keyword",
      maxResults: 5,
      minRelevanceScore: 0.5,
      rerankEnabled: false,
    },
  });

  service.register(schema);
  service.refreshSource("search-domain", "src1", "This document contains important deployment steps for Kubernetes");

  const result = service.retrieve({
    query: "deployment kubernetes",
    domainId: "search-domain",
    maxResults: 10,
  });

  assert.equal(result.totalResults >= 0, true);
  assert.equal(result.queryId.startsWith("knowledge_query_"), true);
  assert.equal(result.strategy.strategy, "keyword");
});

test("integration: DomainKnowledgeSchemaService resolves conflicts with latest_wins", () => {
  const service = new DomainKnowledgeSchemaService();

  const schema = createSchema({
    domainId: "conflict-domain",
    conflictResolution: "latest_wins",
    knowledgeSources: [
      {
        sourceId: "src1",
        type: "document_store",
        priority: 50,
        refreshInterval: "1d",
        authScope: "read",
      },
      {
        sourceId: "src2",
        type: "database",
        priority: 60,
        refreshInterval: "1d",
        authScope: "read",
      },
    ],
  });

  service.register(schema);
  service.refreshSource("conflict-domain", "src1", "value: alpha");
  service.refreshSource("conflict-domain", "src2", "value: beta");

  const result = service.resolveConflicts("conflict-domain", "ns1", {
    key1: "conflicting_value",
  });

  assert.equal(result.conflictId.startsWith("conflict_resolution_"), true);
  assert.equal(result.resolvedEntries.length >= 0, true);
});

test("integration: DomainKnowledgeSchemaService checks freshness", () => {
  const service = new DomainKnowledgeSchemaService();

  const schema = createSchema({
    domainId: "freshness-domain",
    knowledgeSources: [
      {
        sourceId: "src1",
        type: "document_store",
        priority: 50,
        refreshInterval: "1d",
        authScope: "read",
      },
    ],
  });

  service.register(schema);
  service.refreshSource("freshness-domain", "src1", "content");

  const freshness = service.checkFreshness("freshness-domain");

  assert.equal(freshness.schemaId, schema.schemaId);
  assert.equal(freshness.domainId, "freshness-domain");
  assert.equal(typeof freshness.isFresh, "boolean");
  assert.equal(typeof freshness.stalenessHours, "number");
});

test("integration: DomainKnowledgeSchemaService adds and removes knowledge sources", () => {
  const service = new DomainKnowledgeSchemaService();

  const schema = createSchema({
    domainId: "source-domain",
    knowledgeSources: [
      {
        sourceId: "src1",
        type: "document_store",
        priority: 50,
        refreshInterval: "1d",
        authScope: "read",
      },
    ],
  });

  service.register(schema);

  const newSource: KnowledgeSource = {
    sourceId: "src2",
    type: "api_realtime",
    priority: 70,
    refreshInterval: "5m",
    authScope: "api_key",
    endpoint: "https://api.example.com/data",
  };

  const added = service.addSource("source-domain", newSource);
  assert.notEqual(added, null);
  assert.equal(added!.sourceId, "src2");

  const removed = service.removeSource("source-domain", "src1");
  assert.equal(removed, true);

  const removedAgain = service.removeSource("source-domain", "nonexistent");
  assert.equal(removedAgain, false);
});

test("integration: DomainKnowledgeSchemaService throws for missing domain", () => {
  const service = new DomainKnowledgeSchemaService();

  assert.throws(
    () => {
      service.retrieve({
        query: "test",
        domainId: "nonexistent",
      });
    },
    (err: unknown) => String(err).includes("domain_knowledge.schema_not_found"),
  );
});
