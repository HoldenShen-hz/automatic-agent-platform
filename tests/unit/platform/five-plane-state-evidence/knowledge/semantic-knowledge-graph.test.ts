import assert from "node:assert/strict";
import test from "node:test";

import { SemanticKnowledgeGraph } from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import type { ArchivedKnowledgeRecord } from "../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";

function createRecord(
  documentId: string,
  namespace: string,
  chunks: Array<{ chunkId: string; summary: string; keywords: string[] }>,
): ArchivedKnowledgeRecord {
  return {
    source: {
      sourceId: `source-${documentId}`,
      type: "text",
      uri: "https://example.com/test",
      contentHash: `hash-${documentId}`,
      metadata: {},
      ingestedAt: "2026-05-24T00:00:00.000Z",
      namespace,
      language: null,
      tags: [],
      trustLevel: "team_reviewed",
      freshnessTimestamp: "2026-05-24T00:00:00.000Z",
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
    chunks: chunks.map((chunk, index) => ({
      chunkId: chunk.chunkId,
      documentId,
      content: `Content for ${chunk.chunkId}`,
      chunkType: "concept" as const,
      metadata: { relevantFiles: [] },
      embedding: null,
      tokenCount: 100,
      namespace,
      ordinal: index,
      summary: chunk.summary,
      keywords: chunk.keywords,
      embeddingId: null,
      locator: {},
    })),
  };
}

test("SemanticKnowledgeGraph indexes documents chunks and keywords", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    createRecord("doc1", "ns1", [
      { chunkId: "chunk1", summary: "First chunk", keywords: ["typescript", "testing"] },
      { chunkId: "chunk2", summary: "Second chunk", keywords: ["testing"] },
    ]),
  ]);

  const inspection = graph.inspect();
  const connections = graph.getChunkConnections("knowledge:chunk1");

  assert.ok(inspection.nodes.some((node) => node.nodeType === "namespace"));
  assert.ok(inspection.nodes.some((node) => node.nodeType === "document"));
  assert.ok(inspection.nodes.some((node) => node.nodeType === "chunk"));
  assert.ok(inspection.nodes.some((node) => node.nodeType === "keyword"));
  assert.ok(connections);
  assert.ok(connections.keywords.includes("typescript"));
  assert.ok(connections.sharedKeywordRefs.includes("knowledge:chunk2"));
  assert.ok(connections.sameDocumentRefs.includes("knowledge:chunk2"));
});

test("SemanticKnowledgeGraph keyword search is normalized and namespace-aware", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    createRecord("doc1", "ns1", [{ chunkId: "chunk1", summary: "First chunk", keywords: ["TypeScript"] }]),
    createRecord("doc2", "ns2", [{ chunkId: "chunk2", summary: "Second chunk", keywords: ["typescript"] }]),
  ]);

  assert.deepEqual(graph.findChunkKnowledgeRefsByKeyword("TYPESCRIPT", "ns1"), ["knowledge:chunk1"]);
  assert.deepEqual(graph.findChunkKnowledgeRefsByKeyword("typescript", "ns2"), ["knowledge:chunk2"]);
});

test("SemanticKnowledgeGraph supports inspect and trust propagation over learned edges", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    createRecord("doc1", "ns1", [{ chunkId: "chunk1", summary: "First chunk", keywords: ["agent"] }]),
  ]);
  graph.addEntityRelation("entity:a", "entity:b", "trust_boost", 0.8, "official");

  const inspection = graph.inspect({ knowledgeRef: "knowledge:chunk1", limit: 5 });
  const trust = graph.propagateTrust(["entity:entity:a"], 0.25);

  assert.ok(inspection.nodes.some((node) => node.knowledgeRef === "knowledge:chunk1"));
  assert.ok(trust.propagatedNodeIds.includes("entity:entity:a"));
  assert.ok(trust.propagatedNodeIds.includes("entity:entity:b"));
  assert.equal((trust.trustScoreChanges["entity:entity:b"] ?? 0) > 0, true);
});
