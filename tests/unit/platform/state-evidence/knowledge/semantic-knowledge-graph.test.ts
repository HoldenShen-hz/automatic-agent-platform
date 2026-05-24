import assert from "node:assert/strict";
import test from "node:test";

import { SemanticKnowledgeGraph } from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import type { ArchivedKnowledgeRecord } from "../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";

function makeRecord(namespace = "test-ns"): ArchivedKnowledgeRecord {
  return {
    source: {
      sourceId: "src_1",
      type: "file",
      uri: "file:///test/doc.txt",
      contentHash: "abc123",
      metadata: {},
      ingestedAt: "2024-01-01T00:00:00.000Z",
      namespace,
      language: null,
      tags: [],
      trustLevel: "authoritative",
      freshnessTimestamp: "2024-01-01T00:00:00.000Z",
      checksum: "abc123def456",
    },
    document: {
      documentId: "doc_1",
      sourceId: "src_1",
      title: "Test Document",
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
    chunks: [
      {
        chunkId: "chunk_1",
        documentId: "doc_1",
        content: "First chunk content",
        chunkType: "concept",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace,
        ordinal: 0,
        summary: "First chunk",
        keywords: ["typescript", "node"],
        embeddingId: null,
        locator: {},
      },
      {
        chunkId: "chunk_2",
        documentId: "doc_1",
        content: "Second chunk content",
        chunkType: "example",
        metadata: { relevantFiles: [] },
        embedding: null,
        tokenCount: 5,
        namespace,
        ordinal: 1,
        summary: "Second chunk",
        keywords: ["node", "javascript"],
        embeddingId: null,
        locator: {},
      },
    ],
  };
}

test("SemanticKnowledgeGraph.replace rebuilds graph state", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([makeRecord()]);
  assert.ok(graph.inspect().nodes.length > 0);

  graph.replace([]);
  assert.equal(graph.inspect().nodes.length, 0);
  assert.equal(graph.inspect().edges.length, 0);
});

test("SemanticKnowledgeGraph creates keyword and same-document relationships", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([makeRecord()]);

  const refs = graph.findChunkKnowledgeRefsByKeyword("node");
  const connections = graph.getChunkConnections("knowledge:chunk_1");

  assert.deepEqual(refs.sort(), ["knowledge:chunk_1", "knowledge:chunk_2"]);
  assert.ok(connections);
  assert.ok(connections.sharedKeywordRefs.includes("knowledge:chunk_2"));
  assert.ok(connections.sameDocumentRefs.includes("knowledge:chunk_2"));
});

test("SemanticKnowledgeGraph.inspect filters by namespace and keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([makeRecord("ns1"), makeRecord("ns2")]);

  const ns1Inspection = graph.inspect({ namespace: "ns1", limit: 10 });
  const keywordInspection = graph.inspect({ keyword: "typescript", limit: 10 });

  assert.ok(ns1Inspection.nodes.every((node) => node.namespace === "ns1" || node.nodeType === "namespace"));
  assert.ok(keywordInspection.nodes.some((node) => node.nodeType === "keyword"));
});
