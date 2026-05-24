import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgePlaneService } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-plane-service.js";
import { KnowledgeQueryService, QueryLevel } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-query-service.js";
import { SemanticKnowledgeGraph } from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import type { KnowledgeRetrievalService } from "../../../../../src/platform/five-plane-state-evidence/knowledge/retrieval/knowledge-retrieval.js";

function registerNamespace(plane: KnowledgePlaneService, path: string): void {
  plane.registerNamespace({
    namespaceId: `ns:${path}`,
    path,
    description: `namespace ${path}`,
    ownerDomainId: "test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "authoritative",
    maxDocuments: 100,
    maxTotalSizeBytes: 1_000_000,
  });
}

test("KnowledgePlaneService listNamespaces and inspectNamespace reflect the registered state", () => {
  const plane = new KnowledgePlaneService({});
  assert.equal(plane.listNamespaces().length, 0);

  registerNamespace(plane, "test/ns");
  plane.ingest({
    title: "Doc 1",
    body: "Content for doc one.",
    namespace: "test/ns",
    sourceType: "text",
    trustLevel: "authoritative",
  });
  plane.ingest({
    title: "Doc 2",
    body: "Content for doc two with more detail.",
    namespace: "test/ns",
    sourceType: "text",
    trustLevel: "authoritative",
  });

  const namespaces = plane.listNamespaces();
  const inspection = plane.inspectNamespace("test/ns");

  assert.equal(namespaces.length, 1);
  assert.equal(inspection.status, "enabled");
  assert.equal(inspection.documentCount, 2);
  assert.equal(inspection.chunkCount >= 2, true);
});

test("KnowledgePlaneService inspectNamespace returns not_found for unknown namespaces", () => {
  const plane = new KnowledgePlaneService({});
  const result = plane.inspectNamespace("missing/ns");

  assert.equal(result.status, "not_found");
  assert.equal(result.documentCount, 0);
  assert.equal(result.chunkCount, 0);
});

test("KnowledgePlaneService query and queryAsync return stable hit arrays for registered namespaces", async () => {
  const plane = new KnowledgePlaneService({});
  registerNamespace(plane, "async/ns");
  plane.ingest({
    title: "Async Test",
    body: "Async content includes retries and cache recovery.",
    namespace: "async/ns",
    sourceType: "text",
    trustLevel: "official",
  });

  const syncHits = plane.query("cache", { namespace: "async/ns" });
  const asyncHits = await plane.queryAsync("cache", { namespace: "async/ns" });

  assert.equal(syncHits.length > 0, true);
  assert.equal(asyncHits.length > 0, true);
  assert.equal(syncHits[0]?.namespace, "async/ns");
  assert.equal(asyncHits[0]?.namespace, "async/ns");
});

test("SemanticKnowledgeGraph empty graph helpers stay deterministic", () => {
  const graph = new SemanticKnowledgeGraph();

  assert.deepEqual(graph.inspect({ namespace: "missing/ns" }).nodes, []);
  assert.deepEqual(graph.findChunkKnowledgeRefsByKeyword("cache"), graph.findChunkKnowledgeRefsByKeyword("CACHE"));
  assert.equal(graph.getChunkConnections("knowledge:missing"), null);
});

test("KnowledgeQueryService selectQueryLevel respects the quick confidence threshold boundary", () => {
  const service = new KnowledgeQueryService(
    { query: () => [], queryAsync: () => Promise.resolve([]) } as unknown as KnowledgeRetrievalService,
    { quickConfidenceThreshold: 0.5 },
  );

  assert.equal(service.selectQueryLevel(0.5), QueryLevel.Quick);
  assert.equal(service.selectQueryLevel(0.51), QueryLevel.Quick);
  assert.equal(service.selectQueryLevel(0.49), QueryLevel.Standard);
});
