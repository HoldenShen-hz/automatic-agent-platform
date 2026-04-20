import test from "node:test";
import assert from "node:assert/strict";

import { SemanticKnowledgeGraph } from "../../../../../src/platform/state-evidence/knowledge/semantic-knowledge-graph.js";
import type { ArchivedKnowledgeRecord } from "../../../../../src/platform/state-evidence/knowledge/archive/knowledge-archive.js";
import type { KnowledgeSource } from "../../../../../src/platform/state-evidence/knowledge/knowledge-model.js";

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "src_1",
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
      documentId: "doc_1",
      sourceId: "src_1",
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
        chunkId: "chunk_1",
        documentId: "doc_1",
        content: "First chunk content",
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
        chunkId: "chunk_2",
        documentId: "doc_1",
        content: "Second chunk content",
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

test("SemanticKnowledgeGraph.replace clears and rebuilds graph", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([makeRecord()]);

  const inspection = graph.inspect();
  assert.ok(inspection.nodes.length > 0);

  graph.replace([]);

  const emptyInspection = graph.inspect();
  assert.equal(emptyInspection.nodes.length, 0);
});

test("SemanticKnowledgeGraph.upsertRecord adds nodes for namespace, document, and chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({});

  assert.ok(inspection.nodes.length >= 4);
  const nodeTypes = inspection.nodes.map(n => n.nodeType);
  assert.ok(nodeTypes.includes("namespace"));
  assert.ok(nodeTypes.includes("document"));
  assert.ok(nodeTypes.includes("chunk"));
  assert.ok(nodeTypes.includes("keyword"));
});

test("SemanticKnowledgeGraph.upsertRecord creates edges between related nodes", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({});

  assert.ok(inspection.edges.length > 0);
  const relations = inspection.edges.map(e => e.relation);
  assert.ok(relations.includes("contains"));
  assert.ok(relations.includes("shared_keyword"));
  assert.ok(relations.includes("same_document"));
});

test("SemanticKnowledgeGraph.findChunkKnowledgeRefsByKeyword finds matching chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const refs = graph.findChunkKnowledgeRefsByKeyword("typescript");

  assert.equal(refs.length, 1);
  assert.equal(refs[0], "knowledge:chunk_1");
});

test("SemanticKnowledgeGraph.findChunkKnowledgeRefsByKeyword returns empty for unknown keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const refs = graph.findChunkKnowledgeRefsByKeyword("nonexistent");

  assert.equal(refs.length, 0);
});

test("SemanticKnowledgeGraph.findChunkKnowledgeRefsByKeyword filters by namespace when provided", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const refsNs = graph.findChunkKnowledgeRefsByKeyword("node", "test-ns");
  const refsWrongNs = graph.findChunkKnowledgeRefsByKeyword("node", "wrong-ns");

  assert.equal(refsNs.length, 2);
  assert.equal(refsWrongNs.length, 0);
});

test("SemanticKnowledgeGraph.getChunkConnections returns connections for a chunk", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const connections = graph.getChunkConnections("knowledge:chunk_1");

  assert.ok(connections !== null);
  assert.equal(connections.knowledgeRef, "knowledge:chunk_1");
  assert.equal(connections.namespace, "test-ns");
  assert.ok(connections.keywords.length > 0);
});

test("SemanticKnowledgeGraph.getChunkConnections returns null for unknown knowledgeRef", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const connections = graph.getChunkConnections("knowledge:unknown");

  assert.equal(connections, null);
});

test("SemanticKnowledgeGraph.inspect returns adjacent nodes when querying by knowledgeRef", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ knowledgeRef: "knowledge:chunk_1" });

  assert.ok(inspection.nodes.length > 1);
});

test("SemanticKnowledgeGraph.inspect returns adjacent nodes when querying by keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ keyword: "typescript" });

  assert.ok(inspection.nodes.length > 0);
});

test("SemanticKnowledgeGraph.inspect respects limit parameter", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ limit: 2 });

  assert.ok(inspection.nodes.length <= 2);
});

test("SemanticKnowledgeGraph handles multiple records with shared keywords", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    makeRecord({ document: { ...makeRecord().document, documentId: "doc_1" } }),
    makeRecord({ document: { ...makeRecord().document, documentId: "doc_2" } }),
  ]);

  // Both chunks share "node" keyword, so they should be connected via shared_keyword edge
  const inspection = graph.inspect();
  assert.ok(inspection.edges.some(e => e.relation === "shared_keyword"));
});

test("SemanticKnowledgeGraph.upsertRecord handles empty keywords gracefully", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks[0]!.keywords = [];
  record.chunks[1]!.keywords = ["valid"];

  graph.upsertRecord(record);

  const refs = graph.findChunkKnowledgeRefsByKeyword("valid");
  assert.equal(refs.length, 1);
});

test("SemanticKnowledgeGraph.upsertRecord handles whitespace-only keywords", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks[0]!.keywords = ["  ", "  node  "];

  graph.upsertRecord(record);

  // chunk_1 has "node" keyword (from "  node  "), chunk_2 has "node" keyword from original
  const refs = graph.findChunkKnowledgeRefsByKeyword("node");
  assert.equal(refs.length, 2);
});
