/**
 * Unit tests for semantic-knowledge-graph module
 *
 * Tests the knowledge graph structure including nodes, edges, and trust propagation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SemanticKnowledgeGraph,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
  type KnowledgeGraphInspection,
  type KnowledgeGraphChunkConnections,
  type TrustPropagationResult,
} from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import type { ArchivedKnowledgeRecord } from "../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";

function createMockRecord(
  documentId: string,
  namespace: string,
  chunks: Array<{ chunkId: string; summary: string; keywords: string[] }>,
  trustLevel: KnowledgeGraphNode["trustLevel"] = "team_reviewed",
): ArchivedKnowledgeRecord {
  return {
    source: {
      sourceId: `source-${documentId}`,
      type: "text",
      uri: "https://example.com/test",
      contentHash: `hash-${documentId}`,
      metadata: {},
      ingestedAt: new Date().toISOString(),
      namespace,
      trustLevel,
      freshnessTimestamp: new Date().toISOString(),
      checksum: `checksum-${documentId}`,
    },
    document: {
      documentId,
      sourceId: `source-${documentId}`,
      title: `Test Document ${documentId}`,
      version: 1,
      tags: [],
      domainScope: [],
      status: "indexed",
      namespace,
      mimeType: "text/plain",
      rawText: null,
      structuredText: null,
      archived: false,
      archivedAt: null,
    },
    chunks: chunks.map((c, i) => ({
      chunkId: c.chunkId,
      documentId,
      content: `Content for chunk ${c.chunkId}`,
      chunkType: "concept" as const,
      metadata: { relevantFiles: [] },
      embedding: null,
      tokenCount: 100,
      namespace,
      ordinal: i,
      summary: c.summary,
      keywords: c.keywords,
      embeddingId: null,
      locator: {},
    })),
  };
}

test("SemanticKnowledgeGraph initializes empty", () => {
  const graph = new SemanticKnowledgeGraph();
  const inspection = graph.inspect();
  assert.deepEqual(inspection.nodes, []);
  assert.deepEqual(inspection.edges, []);
});

test("SemanticKnowledgeGraph.replace clears existing data and loads new records", () => {
  const graph = new SemanticKnowledgeGraph();

  const record1 = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["test", "example"] },
  ]);
  const record2 = createMockRecord("doc2", "ns2", [
    { chunkId: "chunk2", summary: "Second chunk", keywords: ["demo"] },
  ]);

  graph.replace([record1]);
  let inspection = graph.inspect();
  assert.equal(inspection.nodes.length, 4); // namespace + document + 1 chunk + 1 keyword

  graph.replace([record2]);
  inspection = graph.inspect();
  assert.equal(inspection.nodes.length, 4); // namespace + document + 1 chunk + 1 keyword
});

test("SemanticKnowledgeGraph.upsertRecord adds namespace, document, and chunk nodes", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = createMockRecord("doc1", "test-namespace", [
    { chunkId: "chunk1", summary: "Test chunk summary", keywords: ["keyword1", "keyword2"] },
  ]);

  graph.upsertRecord(record);

  const inspection = graph.inspect();
  assert.ok(inspection.nodes.length >= 4, "Should have namespace, document, chunk, and keyword nodes");

  const namespaceNodes = inspection.nodes.filter((n) => n.nodeType === "namespace");
  assert.equal(namespaceNodes.length, 1);
  assert.equal(namespaceNodes[0].label, "test-namespace");
  assert.equal(namespaceNodes[0].trustLevel, "authoritative");

  const documentNodes = inspection.nodes.filter((n) => n.nodeType === "document");
  assert.equal(documentNodes.length, 1);
  assert.equal(documentNodes[0].label, "Test Document doc1");

  const chunkNodes = inspection.nodes.filter((n) => n.nodeType === "chunk");
  assert.equal(chunkNodes.length, 1);
  assert.equal(chunkNodes[0].knowledgeRef, "knowledge:chunk1");

  const keywordNodes = inspection.nodes.filter((n) => n.nodeType === "keyword");
  assert.equal(keywordNodes.length, 2);
});

test("SemanticKnowledgeGraph.findChunkKnowledgeRefsByKeyword returns matching chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["typescript", "testing"] },
    { chunkId: "chunk2", summary: "Second chunk", keywords: ["javascript", "testing"] },
  ]);

  graph.upsertRecord(record);

  const refs = graph.findChunkKnowledgeRefsByKeyword("testing");
  assert.equal(refs.length, 2);
  assert.ok(refs.includes("knowledge:chunk1"));
  assert.ok(refs.includes("knowledge:chunk2"));
});

test("SemanticKnowledgeGraph.findChunkKnowledgeRefsByKeyword is case-insensitive", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["TypeScript"] },
  ]);

  graph.upsertRecord(record);

  const refsLower = graph.findChunkKnowledgeRefsByKeyword("typescript");
  const refsUpper = graph.findChunkKnowledgeRefsByKeyword("TYPESCRIPT");
  const refsMixed = graph.findChunkKnowledgeRefsByKeyword("Typescript");

  assert.equal(refsLower.length, 1);
  assert.deepEqual(refsUpper, refsLower);
  assert.deepEqual(refsMixed, refsLower);
});

test("SemanticKnowledgeGraph.findChunkKnowledgeRefsByKeyword filters by namespace", () => {
  const graph = new SemanticKnowledgeGraph();
  const record1 = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["shared"] },
  ]);
  const record2 = createMockRecord("doc2", "ns2", [
    { chunkId: "chunk2", summary: "Second chunk", keywords: ["shared"] },
  ]);

  graph.upsertRecord(record1);
  graph.upsertRecord(record2);

  const allRefs = graph.findChunkKnowledgeRefsByKeyword("shared");
  assert.equal(allRefs.length, 2);

  const ns1Refs = graph.findChunkKnowledgeRefsByKeyword("shared", "ns1");
  assert.equal(ns1Refs.length, 1);
  assert.deepEqual(ns1Refs, ["knowledge:chunk1"]);

  const ns2Refs = graph.findChunkKnowledgeRefsByKeyword("shared", "ns2");
  assert.equal(ns2Refs.length, 1);
  assert.deepEqual(ns2Refs, ["knowledge:chunk2"]);
});

test("SemanticKnowledgeGraph.getChunkConnections returns connections for chunk", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["keyword1"] },
    { chunkId: "chunk2", summary: "Second chunk", keywords: ["keyword1", "keyword2"] },
  ]);

  graph.upsertRecord(record);

  const connections = graph.getChunkConnections("knowledge:chunk1");
  assert.ok(connections !== null);
  assert.equal(connections.knowledgeRef, "knowledge:chunk1");
  assert.equal(connections.namespace, "ns1");
  assert.ok(connections.keywords.includes("keyword1"));

  // Same document connection
  assert.ok(connections.sameDocumentRefs.includes("knowledge:chunk2"));

  // No shared keyword refs since chunk1 only has keyword1
  assert.ok(!connections.sharedKeywordRefs.includes("knowledge:chunk2"));
});

test("SemanticKnowledgeGraph.getChunkConnections returns null for unknown knowledgeRef", () => {
  const graph = new SemanticKnowledgeGraph();
  const connections = graph.getChunkConnections("knowledge:unknown");
  assert.equal(connections, null);
});

test("SemanticKnowledgeGraph.inspect filters by namespace", () => {
  const graph = new SemanticKnowledgeGraph();
  const record1 = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["k1"] },
  ]);
  const record2 = createMockRecord("doc2", "ns2", [
    { chunkId: "chunk2", summary: "Second chunk", keywords: ["k2"] },
  ]);

  graph.replace([record1, record2]);

  const ns1Inspection = graph.inspect({ namespace: "ns1" });
  assert.ok(ns1Inspection.nodes.every((n) => n.namespace === "ns1" || n.nodeType === "namespace"));
});

test("SemanticKnowledgeGraph.inspect limits results", () => {
  const graph = new SemanticKnowledgeGraph();
  const records = Array.from({ length: 10 }, (_, i) =>
    createMockRecord(`doc${i}`, "ns1", [
      { chunkId: `chunk${i}`, summary: `Chunk ${i}`, keywords: [`k${i}`] },
    ])
  );

  graph.replace(records);

  const inspection = graph.inspect({ limit: 5 });
  assert.ok(inspection.nodes.length <= 5);
});

test("SemanticKnowledgeGraph.inspect by knowledgeRef returns adjacent nodes", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["keyword1"] },
  ]);

  graph.upsertRecord(record);

  const inspection = graph.inspect({ knowledgeRef: "knowledge:chunk1" });
  assert.ok(inspection.nodes.length >= 2); // chunk + keyword
  assert.ok(inspection.nodes.some((n) => n.knowledgeRef === "knowledge:chunk1"));
});

test("SemanticKnowledgeGraph.inspect by keyword returns adjacent nodes", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["testkeyword"] },
  ]);

  graph.upsertRecord(record);

  const inspection = graph.inspect({ keyword: "testkeyword" });
  assert.ok(inspection.nodes.length >= 2); // keyword + chunk
  assert.ok(inspection.nodes.some((n) => n.nodeType === "keyword" && n.label === "testkeyword"));
});

test("SemanticKnowledgeGraph.addEntityRelation creates entity nodes and edge", () => {
  const graph = new SemanticKnowledgeGraph();

  graph.addEntityRelation("entity1", "entity2", "references", 1.0);

  const inspection = graph.inspect();
  assert.equal(inspection.nodes.length, 2);

  const entityNodes = inspection.nodes.filter((n) => n.nodeType === "entity");
  assert.equal(entityNodes.length, 2);

  const refEdges = inspection.edges.filter((e) => e.relation === "references");
  assert.equal(refEdges.length, 1);
});

test("SemanticKnowledgeGraph.propagateTrust propagates trust through trust_boost edges", () => {
  const graph = new SemanticKnowledgeGraph();

  // Add entity nodes with trust_boost edge
  graph.addEntityRelation("seed", "target1", "trust_boost", 1.0);
  graph.addEntityRelation("target1", "target2", "trust_boost", 1.0);

  const result = graph.propagateTrust(["entity:seed"], 0.1);

  assert.ok(result.propagatedNodeIds.includes("entity:seed"));
  assert.ok(result.trustScoreChanges["entity:seed"] !== undefined);
});

test("SemanticKnowledgeGraph.propagateTrust handles empty seed nodes", () => {
  const graph = new SemanticKnowledgeGraph();
  const result = graph.propagateTrust([], 0.1);

  assert.deepEqual(result.propagatedNodeIds, []);
  assert.deepEqual(result.trustScoreChanges, {});
});

test("SemanticKnowledgeGraph creates same_document edges between consecutive chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["k1"] },
    { chunkId: "chunk2", summary: "Second chunk", keywords: ["k2"] },
    { chunkId: "chunk3", summary: "Third chunk", keywords: ["k3"] },
  ]);

  graph.upsertRecord(record);

  const inspection = graph.inspect();
  const sameDocEdges = inspection.edges.filter((e) => e.relation === "same_document");
  assert.equal(sameDocEdges.length, 2); // chunk1-chunk2 and chunk2-chunk3
});

test("SemanticKnowledgeGraph trust levels are properly set from source", () => {
  const record = createMockRecord("doc1", "ns1", [
    { chunkId: "chunk1", summary: "First chunk", keywords: ["k1"] },
  ], "official");

  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(record);

  const inspection = graph.inspect();
  const chunkNode = inspection.nodes.find((n) => n.nodeType === "chunk");
  assert.equal(chunkNode?.trustLevel, "official");
});
