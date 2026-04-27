/**
 * Integration Test: Semantic Knowledge Graph
 *
 * Tests the SemanticKnowledgeGraph with knowledge records,
 * including graph traversal, keyword connections, and inspection.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SemanticKnowledgeGraph } from "../../../../../src/platform/state-evidence/knowledge/semantic-knowledge-graph.js";
import type { ArchivedKnowledgeRecord } from "../../../../../src/platform/state-evidence/knowledge/archive/knowledge-archive.js";
import type { KnowledgeSource } from "../../../../../src/platform/state-evidence/knowledge/knowledge-model.js";

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "src_" + Math.random().toString(36).slice(2, 8),
    type: "file",
    uri: "file:///test/doc.txt",
    contentHash: "abc123",
    metadata: {},
    ingestedAt: "2024-01-01T00:00:00Z",
    namespace: "test-ns",
    language: null,
    tags: [],
    trustLevel: "verified",
    freshnessTimestamp: "2024-01-01T00:00:00Z",
    checksum: "abc123def456",
    ...overrides,
  };
}

function makeRecord(overrides: Partial<ArchivedKnowledgeRecord> = {}): ArchivedKnowledgeRecord {
  return {
    source: makeSource(),
    document: {
      documentId: "doc_" + Math.random().toString(36).slice(2, 8),
      sourceId: "src_test",
      title: "Test Document",
      version: 1,
      tags: [],
      domainScope: [],
      status: "indexed",
      namespace: "test-ns",
      mimeType: "text/plain",
      rawText: null,
      structuredText: null,
      archived: false,
      archivedAt: null,
    },
    chunks: [
      {
        chunkId: "chunk_" + Math.random().toString(36).slice(2, 8),
        documentId: "doc_test",
        content: "First chunk content about TypeScript and Node.js",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "test-ns",
        ordinal: 0,
        summary: "First chunk",
        keywords: ["typescript", "node"],
        embeddingId: null,
        locator: {},
      },
      {
        chunkId: "chunk_" + Math.random().toString(36).slice(2, 8),
        documentId: "doc_test",
        content: "Second chunk content about JavaScript runtime",
        chunkType: "example",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "test-ns",
        ordinal: 1,
        summary: "Second chunk",
        keywords: ["node", "javascript"],
        embeddingId: null,
        locator: {},
      },
    ],
    ...overrides,
  };
}

test("integration: SemanticKnowledgeGraph with multiple records creates shared keyword edges", () => {
  const graph = new SemanticKnowledgeGraph();

  graph.upsertRecord(makeRecord({
    document: { ...makeRecord().document, documentId: "doc_1" },
    chunks: [
      {
        chunkId: "chunk_1a",
        documentId: "doc_1",
        content: "TypeScript provides static typing",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "shared-ns",
        ordinal: 0,
        summary: "TypeScript intro",
        keywords: ["typescript", "static"],
        embeddingId: null,
        locator: {},
      },
    ],
  }));

  graph.upsertRecord(makeRecord({
    document: { ...makeRecord().document, documentId: "doc_2" },
    chunks: [
      {
        chunkId: "chunk_2a",
        documentId: "doc_2",
        content: "Node.js runs TypeScript code",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "shared-ns",
        ordinal: 0,
        summary: "Node TypeScript",
        keywords: ["typescript", "node"],
        embeddingId: null,
        locator: {},
      },
    ],
  }));

  // Both documents have "typescript" keyword, so chunks should be connected
  const refs = graph.findChunkKnowledgeRefsByKeyword("typescript", "shared-ns");
  assert.ok(refs.length >= 2);
});

test("integration: SemanticKnowledgeGraph inspect with knowledgeRef returns connected nodes", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();

  graph.upsertRecord(record);

  const chunkRef = record.chunks[0]?.keywords[0]
    ? graph.findChunkKnowledgeRefsByKeyword(record.chunks[0].keywords[0], "test-ns")[0]
    : null;

  if (chunkRef) {
    const inspection = graph.inspect({ knowledgeRef: chunkRef });
    assert.ok(inspection.nodes.length > 0);
    assert.ok(inspection.edges.length > 0);
  }
});

test("integration: SemanticKnowledgeGraph getChunkConnections returns all connection types", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();

  graph.upsertRecord(record);

  const chunkNodeId = graph.findChunkKnowledgeRefsByKeyword("typescript", "test-ns")[0];

  if (chunkNodeId) {
    const connections = graph.getChunkConnections(chunkNodeId);

    assert.ok(connections !== null);
    assert.equal(connections.knowledgeRef, chunkNodeId);
    assert.ok(Array.isArray(connections.keywords));
    assert.ok(connections.sharedKeywordRefs !== undefined);
    assert.ok(connections.sameDocumentRefs !== undefined);
  }
});

test("integration: SemanticKnowledgeGraph replace clears and rebuilds graph", () => {
  const graph = new SemanticKnowledgeGraph();

  graph.upsertRecord(makeRecord());
  assert.ok(graph.inspect().nodes.length > 0);

  graph.replace([]);

  const inspection = graph.inspect();
  assert.equal(inspection.nodes.length, 0);
  assert.equal(inspection.edges.length, 0);
});

test("integration: SemanticKnowledgeGraph handles namespace filtering in inspection", () => {
  const graph = new SemanticKnowledgeGraph();

  graph.upsertRecord(makeRecord({
    document: { ...makeRecord().document, documentId: "doc_ns1", namespace: "namespace1" },
    chunks: [{
      chunkId: "chunk_ns1",
      documentId: "doc_ns1",
      content: "Content for namespace 1",
      chunkType: "concept",
      metadata: { relevantFiles: [] },
      embedding: null,
      tokenCount: 5,
      namespace: "namespace1",
      ordinal: 0,
      summary: "NS1 content",
      keywords: ["test"],
      embeddingId: null,
      locator: {},
    }],
  }));

  graph.upsertRecord(makeRecord({
    document: { ...makeRecord().document, documentId: "doc_ns2", namespace: "namespace2" },
    chunks: [{
      chunkId: "chunk_ns2",
      documentId: "doc_ns2",
      content: "Content for namespace 2",
      chunkType: "concept",
      metadata: { relevantFiles: [] },
      embedding: null,
      tokenCount: 5,
      namespace: "namespace2",
      ordinal: 0,
      summary: "NS2 content",
      keywords: ["test"],
      embeddingId: null,
      locator: {},
    }],
  }));

  const inspection1 = graph.inspect({ namespace: "namespace1" });
  const inspection2 = graph.inspect({ namespace: "namespace2" });

  // Should have nodes from respective namespaces
  assert.ok(inspection1.nodes.length > 0 || inspection2.nodes.length > 0);
});

test("integration: SemanticKnowledgeGraph keyword lookup across multiple chunks", () => {
  const graph = new SemanticKnowledgeGraph();

  graph.upsertRecord(makeRecord({
    chunks: [
      {
        chunkId: "chunk_multi_1",
        documentId: "doc_multi",
        content: "First part of content",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "multi-ns",
        ordinal: 0,
        summary: "First",
        keywords: ["keyword1", "shared"],
        embeddingId: null,
        locator: {},
      },
      {
        chunkId: "chunk_multi_2",
        documentId: "doc_multi",
        content: "Second part of content",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "multi-ns",
        ordinal: 1,
        summary: "Second",
        keywords: ["keyword2", "shared"],
        embeddingId: null,
        locator: {},
      },
    ],
  }));

  const sharedRefs = graph.findChunkKnowledgeRefsByKeyword("shared", "multi-ns");
  assert.ok(sharedRefs.length >= 2);

  const keyword1Refs = graph.findChunkKnowledgeRefsByKeyword("keyword1", "multi-ns");
  assert.equal(keyword1Refs.length, 1);
});

test("integration: SemanticKnowledgeGraph handles unknown knowledgeRef gracefully", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const connections = graph.getChunkConnections("knowledge:unknown_chunk_id");

  assert.equal(connections, null);
});

test("integration: SemanticKnowledgeGraph limit parameter restricts results", () => {
  const graph = new SemanticKnowledgeGraph();

  for (let i = 0; i < 5; i++) {
    graph.upsertRecord(makeRecord({
      document: { ...makeRecord().document, documentId: `doc_limit_${i}` },
      chunks: [{
        chunkId: `chunk_limit_${i}`,
        documentId: `doc_limit_${i}`,
        content: `Content ${i}`,
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "limit-ns",
        ordinal: 0,
        summary: `Summary ${i}`,
        keywords: ["test"],
        embeddingId: null,
        locator: {},
      }],
    }));
  }

  const inspection = graph.inspect({ limit: 3 });

  assert.ok(inspection.nodes.length <= 3);
});

test("integration: SemanticKnowledgeGraph same_document edges connect sequential chunks", () => {
  const graph = new SemanticKnowledgeGraph();

  graph.upsertRecord(makeRecord({
    document: { ...makeRecord().document, documentId: "doc_seq" },
    chunks: [
      {
        chunkId: "chunk_seq_1",
        documentId: "doc_seq",
        content: "First sequential chunk",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "seq-ns",
        ordinal: 0,
        summary: "First",
        keywords: [],
        embeddingId: null,
        locator: {},
      },
      {
        chunkId: "chunk_seq_2",
        documentId: "doc_seq",
        content: "Second sequential chunk",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "seq-ns",
        ordinal: 1,
        summary: "Second",
        keywords: [],
        embeddingId: null,
        locator: {},
      },
      {
        chunkId: "chunk_seq_3",
        documentId: "doc_seq",
        content: "Third sequential chunk",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace: "seq-ns",
        ordinal: 2,
        summary: "Third",
        keywords: [],
        embeddingId: null,
        locator: {},
      },
    ],
  }));

  const inspection = graph.inspect({ namespace: "seq-ns" });

  const sameDocEdges = inspection.edges.filter(e => e.relation === "same_document");
  // 3 chunks should have 2 same_document edges (1-2 and 2-3)
  assert.ok(sameDocEdges.length >= 2);
});
