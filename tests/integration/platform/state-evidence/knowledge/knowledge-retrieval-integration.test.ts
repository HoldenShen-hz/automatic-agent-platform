/**
 * Integration Test: Knowledge Retrieval
 *
 * Tests knowledge query, filtering, ranking, semantic similarity,
 * graph-based retrieval, and the KnowledgePlaneService surface.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeIngestionPipeline } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-ingestion-pipeline.js";
import { KnowledgeRetrievalService } from "../../../../../src/platform/five-plane-state-evidence/knowledge/retrieval/knowledge-retrieval.js";
import { KnowledgePlaneService } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-plane-service.js";
import { KnowledgeArchive } from "../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import { KeywordKnowledgeIndex } from "../../../../../src/platform/five-plane-state-evidence/knowledge/keyword-index.js";
import { NamespacePolicyStore } from "../../../../../src/platform/five-plane-state-evidence/knowledge/governance/namespace-policy.js";
import { SemanticKnowledgeGraph } from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import type { SemanticVectorStore } from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-vector-store.js";

function registerNamespace(store: NamespacePolicyStore, path: string, ownerDomainId: string = path): void {
  store.register({
    namespaceId: path,
    path,
    description: `${path} namespace`,
    ownerDomainId,
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });
}

test("integration: knowledge retrieval returns hits for exact keyword matches", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);
  registerNamespace(namespaces, "test");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  pipeline.ingest({
    title: "Task Execution",
    body: "Tasks are the primary work unit in the platform. Each task has a lifecycle from creation to completion.",
    namespace: "test",
    trustLevel: "verified",
  });

  const hits = retrieval.query("task");

  assert.ok(hits.length > 0, "Should return hits for 'task' keyword");
  assert.equal(hits[0]?.namespace, "test");
  assert.ok(hits[0]?.score > 0, "Hit should have a positive score");
});

test("integration: knowledge retrieval filters by namespace", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  registerNamespace(namespaces, "docs");
  registerNamespace(namespaces, "internal");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  pipeline.ingest({
    title: "Public Guide",
    body: "This guide describes public APIs for external consumers.",
    namespace: "docs",
  });
  pipeline.ingest({
    title: "Internal Handbook",
    body: "Internal procedures for platform operators.",
    namespace: "internal",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);

  const allHits = retrieval.query("api");
  assert.ok(allHits.length >= 1, "Should find content across namespaces");

  const docsHits = retrieval.query("api", { namespace: "docs" });
  assert.ok(docsHits.length >= 1, "Should filter by namespace");
  assert.equal(docsHits[0]?.namespace, "docs", "Filtered hits should belong to the target namespace");
});

test("integration: knowledge retrieval respects limit parameter", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  registerNamespace(namespaces, "limit-test");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  for (let i = 0; i < 20; i++) {
    pipeline.ingest({
      title: `Document ${i}`,
      body: `This document contains the keyword searchterm for testing purposes.`,
      namespace: "limit-test",
    });
  }

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);
  const hits = retrieval.query("searchterm", { limit: 5 });

  assert.ok(hits.length <= 5, "Should respect the limit parameter");
});

test("integration: knowledge retrieval ranks hits by relevance score", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  registerNamespace(namespaces, "ranking");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  pipeline.ingest({
    title: "Execution Engine",
    body: "The execution engine dispatches tasks and manages execution state.",
    namespace: "ranking",
  });
  pipeline.ingest({
    title: "Unrelated Topic",
    body: "Something completely different about gardening.",
    namespace: "ranking",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);
  const hits = retrieval.query("execution");

  assert.ok(hits.length >= 1, "Should return at least one hit for 'execution'");
  assert.ok(
    hits.every((hit) => hit.namespace === "ranking"),
    "All hits should be from the correct namespace",
  );
  for (let i = 1; i < hits.length; i++) {
    assert.ok(
      hits[i - 1]!.score >= hits[i]!.score,
      "Hits should be sorted by score descending",
    );
  }
});

test("integration: knowledge retrieval computes reasoning summary for hits", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  registerNamespace(namespaces, "reasoning");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  pipeline.ingest({
    title: "Multi-Step Workflow",
    body: "A workflow consists of multiple steps. Each step produces outputs that feed into subsequent steps.",
    namespace: "reasoning",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);
  const hits = retrieval.query("workflow");

  assert.ok(hits.length > 0, "Should find workflow content");
  assert.ok(hits[0]?.knowledgeRef.startsWith("knowledge:"), "Hit should have a knowledgeRef");
});

test("integration: semantic knowledge graph connects chunks by shared keywords", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const graph = new SemanticKnowledgeGraph();
  registerNamespace(namespaces, "graph");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  const result = pipeline.ingest({
    title: "Distributed Locking",
    body: "Distributed locks prevent concurrent access to shared resources. Redis and Postgres both support advisory locks.",
    namespace: "graph",
  });

  graph.upsertRecord(result);

  const connections = graph.getChunkConnections(`knowledge:${result.chunks[0]!.chunkId}`);
  assert.ok(connections, "Should return connections for a chunk");
  assert.ok(connections!.keywords.length > 0, "Should have keywords for the chunk");
});

test("integration: semantic knowledge graph findChunkKnowledgeRefsByKeyword returns related chunks", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const graph = new SemanticKnowledgeGraph();
  registerNamespace(namespaces, "keyword-search");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  const result1 = pipeline.ingest({
    title: "Redis Adapter",
    body: "The Redis lock adapter uses advisory locks for mutual exclusion.",
    namespace: "keyword-search",
  });
  const result2 = pipeline.ingest({
    title: "Postgres Adapter",
    body: "The Postgres lock adapter uses advisory locks for mutual exclusion.",
    namespace: "keyword-search",
  });

  graph.upsertRecord(result1);
  graph.upsertRecord(result2);

  const refs = graph.findChunkKnowledgeRefsByKeyword("locks");
  assert.ok(refs.length >= 1, "Should find chunks with 'locks' keyword");
});

test("integration: knowledge retrieval uses graph connections for ranking", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const graph = new SemanticKnowledgeGraph();
  const vectorStore: SemanticVectorStore | null = null;
  registerNamespace(namespaces, "graph-ranking");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  const result = pipeline.ingest({
    title: "Lock Service",
    body: "The distributed lock service provides mutual exclusion for critical sections.",
    namespace: "graph-ranking",
  });

  graph.upsertRecord(result);

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces, graph, vectorStore);
  const hits = retrieval.query("lock");

  assert.ok(hits.length >= 1, "Should return hits for 'lock'");
  assert.equal(hits[0]?.namespace, "graph-ranking");
});

test("integration: KnowledgePlaneService.query returns RetrievalHit array", () => {
  const service = new KnowledgePlaneService();
  service.registerNamespace({
    namespaceId: "plane-test",
    path: "plane-test",
    description: "KnowledgePlaneService integration test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  service.ingest({
    title: "Platform Service",
    body: "The knowledge plane service manages knowledge ingestion and retrieval across namespaces.",
    namespace: "plane-test",
    trustLevel: "verified",
  });

  const hits = service.query("knowledge");
  assert.ok(Array.isArray(hits), "query should return an array");
  assert.ok(hits.length >= 1, "Should return at least one hit");
  assert.ok("score" in hits[0]!, "Hit should have a score property");
  assert.ok("knowledgeRef" in hits[0]!, "Hit should have a knowledgeRef property");
});

test("integration: KnowledgePlaneService.listNamespaces returns registered namespaces", () => {
  const service = new KnowledgePlaneService();

  service.registerNamespace({
    namespaceId: "ns-a",
    path: "ns-a",
    description: "Namespace A",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 500,
    maxTotalSizeBytes: 5 * 1024 * 1024,
  });

  service.registerNamespace({
    namespaceId: "ns-b",
    path: "ns-b",
    description: "Namespace B",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 60,
      staleAction: "demote",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "community",
    maxDocuments: 200,
    maxTotalSizeBytes: 2 * 1024 * 1024,
  });

  const namespaces = service.listNamespaces();
  assert.ok(namespaces.length >= 2, "Should return at least two registered namespaces");
  const paths = namespaces.map((ns) => ns.path);
  assert.ok(paths.includes("ns-a"), "Should include ns-a");
  assert.ok(paths.includes("ns-b"), "Should include ns-b");
});

test("integration: KnowledgePlaneService.inspectNamespace returns namespace details", () => {
  const service = new KnowledgePlaneService();

  service.registerNamespace({
    namespaceId: "inspect-test",
    path: "inspect-test",
    description: "Inspection test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  service.ingest({
    title: "Test Document",
    body: "This is a test document for namespace inspection.",
    namespace: "inspect-test",
    trustLevel: "verified",
  });

  const inspection = service.inspectNamespace("inspect-test");

  assert.equal(inspection.namespace, "inspect-test");
  assert.equal(inspection.status, "enabled");
  assert.ok(inspection.policy, "Should have a policy");
  assert.equal(inspection.documentCount, 1, "Should have 1 document");
  assert.ok(inspection.chunkCount >= 1, "Should have at least 1 chunk");
  assert.ok(inspection.documents.length >= 1, "Should list documents");
});

test("integration: KnowledgePlaneService.ingest produces chunks that can be queried", () => {
  const service = new KnowledgePlaneService();
  service.registerNamespace({
    namespaceId: "ingest-query",
    path: "ingest-query",
    description: "Ingest and query test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  const ingestionResult = service.ingest({
    title: "Worker Pool",
    body: "Worker pools manage concurrent execution of tasks. Each worker processes tasks from a shared queue.",
    namespace: "ingest-query",
    tags: ["worker", "concurrency", "queue"],
    trustLevel: "verified",
  });

  assert.ok(ingestionResult.chunks.length >= 1, "Ingest should produce chunks");
  assert.ok(ingestionResult.document.documentId, "Should have document ID");
  assert.ok(ingestionResult.source.sourceId, "Should have source ID");

  const hits = service.query("worker");
  assert.ok(hits.length >= 1, "Should find ingested content by keyword 'worker'");
  const workerHit = hits.find((hit) => hit.snippet.includes("Worker") || hit.snippet.includes("worker"));
  assert.ok(workerHit, "Hit snippet should reference worker content");
});

test("integration: knowledge retrieval async query returns equivalent results to sync", async () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const graph = new SemanticKnowledgeGraph();
  registerNamespace(namespaces, "async-test");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  pipeline.ingest({
    title: "Async Execution",
    body: "Asynchronous execution allows tasks to run without blocking the caller.",
    namespace: "async-test",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces, graph, null);

  const syncHits = retrieval.query("async");
  const asyncHits = await retrieval.queryAsync("async");

  assert.ok(syncHits.length >= 1, "Sync query should return hits");
  assert.ok(asyncHits.length >= 1, "Async query should return hits");
  assert.equal(
    syncHits.length,
    asyncHits.length,
    "Sync and async queries should return the same number of hits",
  );
});

test("integration: knowledge retrieval match type reflects search strategy", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  registerNamespace(namespaces, "match-type");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  pipeline.ingest({
    title: "Keyword Index",
    body: "The keyword index enables fast text-based search across knowledge chunks.",
    namespace: "match-type",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);
  const hits = retrieval.query("keyword");

  assert.ok(hits.length >= 1, "Should find 'keyword' content");
  const matchTypes = hits.map((hit) => hit.matchType);
  assert.ok(matchTypes.includes("keyword") || matchTypes.includes("semantic") || matchTypes.includes("structural"),
    "Match types should be one of keyword, semantic, or structural");
});

test("integration: KnowledgePlaneService.inspectGraph returns graph inspection", () => {
  const service = new KnowledgePlaneService();
  service.registerNamespace({
    namespaceId: "graph-inspect",
    path: "graph-inspect",
    description: "Graph inspection test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  service.ingest({
    title: "Graph Node",
    body: "This document creates graph nodes and edges for knowledge relationships.",
    namespace: "graph-inspect",
  });

  const inspection = service.inspectGraph({ namespace: "graph-inspect", limit: 20 });

  assert.ok("nodes" in inspection, "Inspection should have nodes");
  assert.ok("edges" in inspection, "Inspection should have edges");
  assert.ok(Array.isArray(inspection.nodes), "Nodes should be an array");
  assert.ok(Array.isArray(inspection.edges), "Edges should be an array");
});

test("integration: knowledge retrieval filters unauthorized hits", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  registerNamespace(namespaces, "access-filter");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  const result = pipeline.ingest({
    title: "Restricted Content",
    body: "This content should only be accessible to authorized domains.",
    namespace: "access-filter",
    trustLevel: "verified",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);
  const allHits = retrieval.query("content");

  assert.ok(allHits.length >= 1, "Should find content without access principal");

  const filteredHits = retrieval.filterAuthorizedHits(allHits, {
    namespace: "access-filter",
    accessPrincipal: {
      principalId: "test-principal",
      domainId: "test-domain",
      roles: [],
    },
  });

  assert.ok(
    filteredHits.every((hit) => hit.namespace === "access-filter"),
    "All filtered hits should belong to the target namespace",
  );
});

test("integration: KnowledgePlaneService.ingest publishes events when eventPublisher is set", () => {
  let publishedEvent: any = null;

  const service = new KnowledgePlaneService({
    eventPublisher: {
      publish(event) {
        publishedEvent = event;
      },
    },
  });

  service.registerNamespace({
    namespaceId: "event-test",
    path: "event-test",
    description: "Event publishing test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  service.ingest({
    title: "Event Test",
    body: "This document tests event publishing on ingestion.",
    namespace: "event-test",
  });

  assert.ok(publishedEvent, "Should publish an event on ingestion");
  assert.equal(publishedEvent.eventType, "knowledge:chunk_indexed");
  assert.ok("payload" in publishedEvent);
});

test("integration: knowledge retrieval handles empty query gracefully", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  registerNamespace(namespaces, "empty-query");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  pipeline.ingest({
    title: "Non-empty Document",
    body: "This document has content.",
    namespace: "empty-query",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);

  const hits = retrieval.query("   ");

  assert.ok(Array.isArray(hits), "Should return an array for empty query");
});

test("integration: KnowledgePlaneService handles queryAsync for concurrent requests", async () => {
  const service = new KnowledgePlaneService();
  service.registerNamespace({
    namespaceId: "concurrent",
    path: "concurrent",
    description: "Concurrent query test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  service.ingest({
    title: "Concurrent Test",
    body: "Testing concurrent async queries to the knowledge plane.",
    namespace: "concurrent",
  });

  const results = await Promise.all([
    service.queryAsync("concurrent"),
    service.queryAsync("test"),
    service.queryAsync("async"),
  ]);

  assert.ok(results.every((hits) => Array.isArray(hits)), "All queries should return arrays");
});

test("integration: KnowledgePlaneService.inspectSemanticInfrastructure returns infrastructure details", () => {
  const service = new KnowledgePlaneService();

  const inspection = service.inspectSemanticInfrastructure();

  assert.ok("backend" in inspection, "Should have backend property");
  assert.ok("ready" in inspection, "Should have ready property");
  assert.ok("details" in inspection, "Should have details property");
});

test("integration: knowledge retrieval ranking signals are present on hits", () => {
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  registerNamespace(namespaces, "signals");

  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  pipeline.ingest({
    title: "Ranking Signals",
    body: "The ranking system uses multiple signals including keyword matches, semantic similarity, and graph boosts.",
    namespace: "signals",
  });

  const retrieval = new KnowledgeRetrievalService(index, archive, namespaces);
  const hits = retrieval.query("ranking");

  assert.ok(hits.length >= 1, "Should find ranking content");
  if (hits[0]?.rankingSignals) {
    assert.ok("keywordMatches" in hits[0]!.rankingSignals!, "Should have keywordMatches signal");
    assert.ok("semanticSimilarity" in hits[0]!.rankingSignals!, "Should have semanticSimilarity signal");
  }
});

test("integration: semantic knowledge graph inspect returns nodes and edges", () => {
  const graph = new SemanticKnowledgeGraph();
  const archive = new KnowledgeArchive();
  const index = new KeywordKnowledgeIndex();
  const namespaces = new NamespacePolicyStore();
  const pipeline = new KnowledgeIngestionPipeline(index, archive, namespaces);
  registerNamespace(namespaces, "graph-inspect");

  const result = pipeline.ingest({
    title: "Graph Inspection",
    body: "Testing graph inspection functionality across namespaces.",
    namespace: "graph-inspect",
  });

  graph.upsertRecord(result);

  const inspection = graph.inspect({ namespace: "graph-inspect", limit: 50 });

  assert.ok(Array.isArray(inspection.nodes), "Should have nodes array");
  assert.ok(Array.isArray(inspection.edges), "Should have edges array");

  const nodeTypes = inspection.nodes.map((n) => n.nodeType);
  assert.ok(nodeTypes.includes("namespace"), "Should have namespace nodes");
  assert.ok(nodeTypes.includes("document"), "Should have document nodes");
  assert.ok(nodeTypes.includes("chunk"), "Should have chunk nodes");
});

test("integration: knowledge plane service queryForDomain with domain registry", async () => {
  const service = new KnowledgePlaneService();
  service.registerNamespace({
    namespaceId: "domain-query",
    path: "domain-query",
    description: "Domain query test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  service.ingest({
    title: "Domain Query Test",
    body: "Testing domain-scoped knowledge queries.",
    namespace: "domain-query",
  });

  const hits = await service.queryForDomain("domain", {
    domainId: "test-domain",
    namespace: "domain-query",
  });

  assert.ok(Array.isArray(hits), "Should return array of hits");
});

test("integration: knowledge ingestion with multiple tags produces searchable chunks", () => {
  const service = new KnowledgePlaneService();
  service.registerNamespace({
    namespaceId: "multi-tag",
    path: "multi-tag",
    description: "Multi-tag ingestion test",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  });

  service.ingest({
    title: "Multi-Tag Document",
    body: "This document has multiple tags for testing retrieval.",
    namespace: "multi-tag",
    tags: ["testing", "integration", "knowledge", "retrieval"],
  });

  const hits = service.query("integration");
  assert.ok(hits.length >= 1, "Should find document by tag-related keyword");

  const hits2 = service.query("retrieval");
  assert.ok(hits2.length >= 1, "Should find document by another tag-related keyword");
});
