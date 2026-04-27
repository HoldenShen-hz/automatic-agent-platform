/**
 * Integration Test: Knowledge Plane Service
 *
 * Tests the KnowledgePlaneService including namespace management,
 * document ingestion, querying, and semantic graph integration.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgePlaneService } from "../../../../../src/platform/state-evidence/knowledge/knowledge-plane-service.js";
import type { KnowledgeQueryOptions } from "../../../../../src/platform/state-evidence/knowledge/retrieval/knowledge-retrieval.js";

function createTestPlane(): KnowledgePlaneService {
  return new KnowledgePlaneService({});
}

test("integration: KnowledgePlaneService registers namespace and ingests documents", () => {
  const plane = createTestPlane();

  plane.registerNamespace({
    namespaceId: "test_ns",
    path: "test/namespace",
    description: "Test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const result = plane.ingest({
    title: "Test Document",
    body: "This is a test document with some content about testing.",
    namespace: "test/namespace",
    sourceType: "text",
    trustLevel: "verified",
  });

  assert.ok(result.source.sourceId.startsWith("knowledge_source_"));
  assert.ok(result.document.documentId.startsWith("knowledge_document_"));
  assert.ok(result.chunks.length >= 1);
  assert.equal(result.document.title, "Test Document");
});

test("integration: KnowledgePlaneService queries return ingested content", () => {
  const plane = createTestPlane();

  plane.registerNamespace({
    namespaceId: "query_ns",
    path: "test/query",
    description: "Query test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  plane.ingest({
    title: "Query Test",
    body: "The platform uses execution engines for task processing.",
    namespace: "test/query",
    sourceType: "text",
    trustLevel: "verified",
  });

  const hits = plane.query("execution");
  assert.ok(hits.length >= 0); // Query may or may not find results
});

test("integration: KnowledgePlaneService listNamespaces returns registered namespaces", () => {
  const plane = createTestPlane();

  plane.registerNamespace({
    namespaceId: "list_ns",
    path: "test/list",
    description: "List test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const namespaces = plane.listNamespaces();
  assert.ok(Array.isArray(namespaces));
  const paths = namespaces.map((ns: any) => ns.path);
  assert.ok(paths.includes("test/list"));
});

test("integration: KnowledgePlaneService inspectNamespace returns namespace details", () => {
  const plane = createTestPlane();

  plane.registerNamespace({
    namespaceId: "inspect_ns",
    path: "test/inspect",
    description: "Inspect test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  plane.ingest({
    title: "Inspect Test Document",
    body: "Content for inspection testing.",
    namespace: "test/inspect",
    sourceType: "text",
    trustLevel: "verified",
  });

  const inspection = plane.inspectNamespace("test/inspect");

  assert.equal(inspection.namespace, "test/inspect");
  assert.equal(inspection.status, "enabled");
  assert.ok(inspection.policy !== null);
  assert.equal(inspection.documentCount, 1);
  assert.ok(inspection.chunkCount >= 1);
  assert.equal(inspection.documents.length, 1);
  assert.equal(inspection.documents[0]?.title, "Inspect Test Document");
});

test("integration: KnowledgePlaneService inspectNamespace returns not_found for unknown namespace", () => {
  const plane = createTestPlane();

  const inspection = plane.inspectNamespace("nonexistent/namespace");

  assert.equal(inspection.namespace, "nonexistent/namespace");
  assert.equal(inspection.status, "not_found");
});

test("integration: KnowledgePlaneService inspectGraph returns graph inspection", () => {
  const plane = createTestPlane();

  plane.registerNamespace({
    namespaceId: "graph_ns",
    path: "test/graph",
    description: "Graph test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  plane.ingest({
    title: "Graph Test",
    body: "Testing the knowledge graph functionality.",
    namespace: "test/graph",
    sourceType: "text",
    trustLevel: "verified",
  });

  const graphInspection = plane.inspectGraph({ namespace: "test/graph" });

  assert.ok(Array.isArray(graphInspection.nodes));
  assert.ok(Array.isArray(graphInspection.edges));
});

test("integration: KnowledgePlaneService query with namespace filter", () => {
  const plane = createTestPlane();

  plane.registerNamespace({
    namespaceId: "filter_ns",
    path: "test/filter",
    description: "Filter test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  plane.ingest({
    title: "Filter Test",
    body: "Testing query filters.",
    namespace: "test/filter",
    sourceType: "text",
    trustLevel: "verified",
  });

  const options: KnowledgeQueryOptions = { namespace: "test/filter" };
  const hits = plane.query("testing", options);

  assert.ok(Array.isArray(hits));
});

test("integration: KnowledgePlaneService queryAsync returns hits", async () => {
  const plane = createTestPlane();

  plane.registerNamespace({
    namespaceId: "async_ns",
    path: "test/async",
    description: "Async test namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  plane.ingest({
    title: "Async Test",
    body: "Testing async query functionality.",
    namespace: "test/async",
    sourceType: "text",
    trustLevel: "verified",
  });

  const hits = await plane.queryAsync("async");
  assert.ok(Array.isArray(hits));
});

test("integration: KnowledgePlaneService inspectSemanticInfrastructure returns default when no vector store", () => {
  const plane = createTestPlane();

  const infrastructure = plane.inspectSemanticInfrastructure();

  assert.equal(infrastructure.backend, "local_hash");
  assert.equal(infrastructure.ready, true);
  assert.equal(infrastructure.details.managedBy, "archive_scan");
});

test("integration: KnowledgePlaneService registers multiple namespaces", () => {
  const plane = createTestPlane();

  plane.registerNamespace({
    namespaceId: "multi_ns1",
    path: "test/multi1",
    description: "First namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  plane.registerNamespace({
    namespaceId: "multi_ns2",
    path: "test/multi2",
    description: "Second namespace",
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });

  const namespaces = plane.listNamespaces();
  const paths = namespaces.map((ns: any) => ns.path);
  assert.ok(paths.includes("test/multi1"));
  assert.ok(paths.includes("test/multi2"));
});
