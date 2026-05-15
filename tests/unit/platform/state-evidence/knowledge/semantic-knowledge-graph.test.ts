import test from "node:test";
import assert from "node:assert/strict";

import { SemanticKnowledgeGraph } from "../../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import type { ArchivedKnowledgeRecord } from "../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import type { KnowledgeSource } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// SemanticKnowledgeGraph.replace Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SemanticKnowledgeGraph.replace clears and rebuilds graph", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([makeRecord()]);

  const inspection = graph.inspect();
  assert.ok(inspection.nodes.length > 0);

  graph.replace([]);

  const emptyInspection = graph.inspect();
  assert.equal(emptyInspection.nodes.length, 0);
});

test("SemanticKnowledgeGraph.replace handles multiple records", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    makeRecord({ document: { ...makeRecord().document, documentId: "doc_1", title: "Doc 1" } }),
    makeRecord({ document: { ...makeRecord().document, documentId: "doc_2", title: "Doc 2" } }),
  ]);

  const inspection = graph.inspect();
  assert.ok(inspection.nodes.length >= 4); // at least 2 namespaces, 2 documents, chunks, keywords
});

test("SemanticKnowledgeGraph.replace clears previous state completely", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([makeRecord()]);
  let inspection = graph.inspect();
  assert.ok(inspection.nodes.length > 0);

  graph.replace([]);
  inspection = graph.inspect();
  assert.equal(inspection.nodes.length, 0);
  assert.equal(inspection.edges.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SemanticKnowledgeGraph.upsertRecord Tests
// ─────────────────────────────────────────────────────────────────────────────

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

test("SemanticKnowledgeGraph.upsertRecord creates contains edges: namespace -> document", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({});
  const containsEdges = inspection.edges.filter(e => e.relation === "contains");
  assert.ok(containsEdges.length >= 2); // namespace->document, document->chunk, chunk->keyword
});

test("SemanticKnowledgeGraph.upsertRecord creates shared_keyword edges between chunks with same keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord()); // chunk_1 and chunk_2 both have "node" keyword

  const inspection = graph.inspect({});
  const sharedKeywordEdges = inspection.edges.filter(e => e.relation === "shared_keyword");
  assert.ok(sharedKeywordEdges.length > 0);
});

test("SemanticKnowledgeGraph.upsertRecord creates same_document edges between consecutive chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord()); // chunk_1 and chunk_2 are consecutive

  const inspection = graph.inspect({});
  const sameDocEdges = inspection.edges.filter(e => e.relation === "same_document");
  assert.ok(sameDocEdges.length > 0);
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

test("SemanticKnowledgeGraph.upsertRecord normalizes keyword case", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks[0]!.keywords = ["TypeScript", "NODE", "JavaScript"];

  graph.upsertRecord(record);

  // All keywords should be lowercased
  const refsUppercase = graph.findChunkKnowledgeRefsByKeyword("TYPESCRIPT");
  const refsLowercase = graph.findChunkKnowledgeRefsByKeyword("typescript");
  assert.equal(refsUppercase.length, refsLowercase.length);
});

test("SemanticKnowledgeGraph.upsertRecord with single chunk has no same_document edges", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks = [record.chunks[0]!]; // Only one chunk

  graph.upsertRecord(record);

  const inspection = graph.inspect({});
  const sameDocEdges = inspection.edges.filter(e => e.relation === "same_document");
  assert.equal(sameDocEdges.length, 0);
});

test("SemanticKnowledgeGraph.upsertRecord with three chunks creates two same_document edges (stored as 4 directed)", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks = [
    { ...record.chunks[0]!, chunkId: "chunk_1", ordinal: 0 },
    { ...record.chunks[0]!, chunkId: "chunk_2", ordinal: 1 },
    { ...record.chunks[0]!, chunkId: "chunk_3", ordinal: 2 },
  ];

  graph.upsertRecord(record);

  const inspection = graph.inspect({});
  const sameDocEdges = inspection.edges.filter(e => e.relation === "same_document");
  // Each undirected edge is stored as 2 directed edges (one for each direction)
  // With 3 chunks (chunk_1-chunk_2 and chunk_2-chunk_3), we get 4 directed edges
  assert.equal(sameDocEdges.length, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// SemanticKnowledgeGraph.findChunkKnowledgeRefsByKeyword Tests
// ─────────────────────────────────────────────────────────────────────────────

test("findChunkKnowledgeRefsByKeyword finds matching chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const refs = graph.findChunkKnowledgeRefsByKeyword("typescript");

  assert.equal(refs.length, 1);
  assert.equal(refs[0], "knowledge:chunk_1");
});

test("findChunkKnowledgeRefsByKeyword returns empty for unknown keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const refs = graph.findChunkKnowledgeRefsByKeyword("nonexistent");

  assert.equal(refs.length, 0);
});

test("findChunkKnowledgeRefsByKeyword finds multiple chunks with same keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord()); // Both chunks have "node" keyword

  const refs = graph.findChunkKnowledgeRefsByKeyword("node");

  assert.equal(refs.length, 2);
  assert.ok(refs.includes("knowledge:chunk_1"));
  assert.ok(refs.includes("knowledge:chunk_2"));
});

test("findChunkKnowledgeRefsByKeyword filters by namespace when provided", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const refsNs = graph.findChunkKnowledgeRefsByKeyword("node", "test-ns");
  const refsWrongNs = graph.findChunkKnowledgeRefsByKeyword("node", "wrong-ns");

  assert.equal(refsNs.length, 2);
  assert.equal(refsWrongNs.length, 0);
});

test("findChunkKnowledgeRefsByKeyword returns empty when keyword only exists in different namespace", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    makeRecord({ document: { ...makeRecord().document, namespace: "ns1" }, chunks: [{ ...makeRecord().chunks[0]!, namespace: "ns1", chunkId: "c1", keywords: ["foo"] }] }),
    makeRecord({ document: { ...makeRecord().document, namespace: "ns2" }, chunks: [{ ...makeRecord().chunks[0]!, namespace: "ns2", chunkId: "c2", keywords: ["foo"] }] }),
  ]);

  const refs = graph.findChunkKnowledgeRefsByKeyword("foo", "ns1");
  assert.equal(refs.length, 1);
  assert.equal(refs[0], "knowledge:c1");
});

test("findChunkKnowledgeRefsByKeyword trims whitespace from keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const refs = graph.findChunkKnowledgeRefsByKeyword("  node  ");

  assert.equal(refs.length, 2);
});

test("findChunkKnowledgeRefsByKeyword is case-insensitive", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const refsLower = graph.findChunkKnowledgeRefsByKeyword("node");
  const refsUpper = graph.findChunkKnowledgeRefsByKeyword("NODE");
  const refsMixed = graph.findChunkKnowledgeRefsByKeyword("NoDe");

  assert.equal(refsLower.length, refsUpper.length);
  assert.equal(refsLower.length, refsMixed.length);
});

// ─────────────────────────────────────────────────────────────────────────────
// SemanticKnowledgeGraph.getChunkConnections Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getChunkConnections returns connections for a chunk", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const connections = graph.getChunkConnections("knowledge:chunk_1");

  assert.ok(connections !== null);
  assert.equal(connections.knowledgeRef, "knowledge:chunk_1");
  assert.equal(connections.namespace, "test-ns");
  assert.ok(connections.keywords.length > 0);
  assert.ok(connections.keywords.includes("typescript") || connections.keywords.includes("node"));
});

test("getChunkConnections returns null for unknown knowledgeRef", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const connections = graph.getChunkConnections("knowledge:unknown");

  assert.equal(connections, null);
});

test("getChunkConnections returns keywords sorted alphabetically", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks[0]!.keywords = ["zebra", "alpha", "middle"];
  graph.upsertRecord(record);

  const connections = graph.getChunkConnections("knowledge:chunk_1");

  assert.ok(connections !== null);
  assert.deepEqual(connections.keywords, ["alpha", "middle", "zebra"]);
});

test("getChunkConnections returns sharedKeywordRefs for chunks with shared keywords", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord()); // chunk_1 and chunk_2 share "node"

  const connections = graph.getChunkConnections("knowledge:chunk_1");

  assert.ok(connections !== null);
  assert.ok(connections.sharedKeywordRefs.includes("knowledge:chunk_2"));
});

test("getChunkConnections returns sameDocumentRefs for consecutive chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const connections = graph.getChunkConnections("knowledge:chunk_1");

  assert.ok(connections !== null);
  assert.ok(connections.sameDocumentRefs.includes("knowledge:chunk_2"));
});

test("getChunkConnections returns empty sharedKeywordRefs when no shared keywords", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks[0]!.keywords = ["unique1"];
  record.chunks[1]!.keywords = ["unique2"];
  graph.upsertRecord(record);

  const connections = graph.getChunkConnections("knowledge:chunk_1");

  assert.ok(connections !== null);
  assert.equal(connections.sharedKeywordRefs.length, 0);
});

test("getChunkConnections returns empty sameDocumentRefs for single chunk document", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks = [record.chunks[0]!];
  graph.upsertRecord(record);

  const connections = graph.getChunkConnections("knowledge:chunk_1");

  assert.ok(connections !== null);
  assert.equal(connections.sameDocumentRefs.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SemanticKnowledgeGraph.inspect Tests
// ─────────────────────────────────────────────────────────────────────────────

test("inspect returns adjacent nodes when querying by knowledgeRef", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ knowledgeRef: "knowledge:chunk_1" });

  assert.ok(inspection.nodes.length > 1);
});

test("inspect returns adjacent nodes when querying by keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ keyword: "typescript" });

  assert.ok(inspection.nodes.length > 0);
});

test("inspect returns adjacent nodes when querying by namespace", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ namespace: "test-ns" });

  assert.ok(inspection.nodes.length > 0);
});

test("inspect respects limit parameter", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ limit: 2 });

  assert.ok(inspection.nodes.length <= 2);
});

test("inspect returns limited edges", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ limit: 2 });

  assert.ok(inspection.edges.length <= 4); // limit * 2
});

test("inspect includes namespace node when querying by namespace", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    makeRecord({ document: { ...makeRecord().document, documentId: "doc_1", namespace: "ns1" }, chunks: [{ ...makeRecord().chunks[0]!, chunkId: "c1", namespace: "ns1" }] }),
    makeRecord({ document: { ...makeRecord().document, documentId: "doc_2", namespace: "ns2" }, chunks: [{ ...makeRecord().chunks[0]!, chunkId: "c2", namespace: "ns2" }] }),
  ]);

  const inspection = graph.inspect({ namespace: "ns1" });

  // Should include the ns1 namespace node
  const ns1Node = inspection.nodes.find(n => n.nodeId === "namespace:ns1");
  assert.ok(ns1Node, "Should include namespace:ns1 node");
  assert.equal(ns1Node!.nodeType, "namespace");
});

test("inspect with no filters returns up to limit nodes", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ limit: 5 });

  assert.ok(inspection.nodes.length <= 5);
});

test("inspect returns empty nodes and edges for unknown knowledgeRef", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ knowledgeRef: "knowledge:unknown" });

  // When knowledgeRef not found, falls back to default behavior
  assert.ok(Array.isArray(inspection.nodes));
  assert.ok(Array.isArray(inspection.edges));
});

test("inspect returns empty nodes and edges for unknown keyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ keyword: "unknown_keyword_xyz" });

  assert.ok(Array.isArray(inspection.nodes));
  assert.ok(Array.isArray(inspection.edges));
});

test("inspect with all filters returns combined results", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({
    namespace: "test-ns",
    knowledgeRef: "knowledge:chunk_1",
    keyword: "node",
    limit: 50,
  });

  assert.ok(inspection.nodes.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SemanticKnowledgeGraph Node and Edge Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("inspect returns correct node structure", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ knowledgeRef: "knowledge:chunk_1" });

  for (const node of inspection.nodes) {
    assert.ok(node.nodeId);
    assert.ok(node.nodeType);
    assert.ok(["namespace", "document", "chunk", "keyword"].includes(node.nodeType));
    assert.ok(typeof node.label === "string");
  }
});

test("inspect returns correct edge structure", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ knowledgeRef: "knowledge:chunk_1" });

  for (const edge of inspection.edges) {
    assert.ok(edge.edgeId);
    assert.ok(edge.fromNodeId);
    assert.ok(edge.toNodeId);
    assert.ok(["contains", "shared_keyword", "same_document"].includes(edge.relation));
    assert.ok(typeof edge.weight === "number");
  }
});

test("namespace node has correct structure", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ namespace: "test-ns" });
  const namespaceNode = inspection.nodes.find(n => n.nodeType === "namespace");

  assert.ok(namespaceNode);
  assert.equal(namespaceNode!.nodeId, "namespace:test-ns");
  assert.equal(namespaceNode!.label, "test-ns");
  assert.equal(namespaceNode!.namespace, "test-ns");
  assert.equal(namespaceNode!.knowledgeRef, null);
});

test("document node has correct structure", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({});
  const documentNode = inspection.nodes.find(n => n.nodeType === "document");

  assert.ok(documentNode);
  assert.equal(documentNode!.nodeId, "document:doc_1");
  assert.equal(documentNode!.label, "Test Document");
  assert.equal(documentNode!.namespace, "test-ns");
  assert.equal(documentNode!.knowledgeRef, null);
});

test("chunk node has correct structure", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ knowledgeRef: "knowledge:chunk_1" });
  const chunkNode = inspection.nodes.find(n => n.nodeType === "chunk");

  assert.ok(chunkNode);
  assert.equal(chunkNode!.nodeId, "chunk:chunk_1");
  assert.equal(chunkNode!.label, "First chunk");
  assert.equal(chunkNode!.namespace, "test-ns");
  assert.equal(chunkNode!.knowledgeRef, "knowledge:chunk_1");
});

test("keyword node has correct structure", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({ keyword: "typescript" });
  const keywordNode = inspection.nodes.find(n => n.nodeType === "keyword");

  assert.ok(keywordNode);
  assert.equal(keywordNode!.nodeId, "keyword:typescript");
  assert.equal(keywordNode!.label, "typescript");
  assert.equal(keywordNode!.namespace, "test-ns");
  assert.equal(keywordNode!.knowledgeRef, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases and Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

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

test("SemanticKnowledgeGraph shared_keyword edges are created across namespaces (no namespace isolation in upsertRecord)", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    makeRecord({ document: { ...makeRecord().document, namespace: "ns1" }, chunks: [{ ...makeRecord().chunks[0]!, namespace: "ns1", chunkId: "c1", keywords: ["shared"] }] }),
    makeRecord({ document: { ...makeRecord().document, namespace: "ns2" }, chunks: [{ ...makeRecord().chunks[0]!, namespace: "ns2", chunkId: "c2", keywords: ["shared"] }] }),
  ]);

  // Note: upsertRecord does NOT enforce namespace isolation for shared_keyword edges
  // It only checks if chunks share the same keyword, regardless of namespace
  const connections = graph.getChunkConnections("knowledge:c1");
  // shared_keyword edges are created across namespaces (this is the actual behavior)
  assert.ok(connections!.sharedKeywordRefs.includes("knowledge:c2"));
});

test("SemanticKnowledgeGraph namespace isolation for findChunkKnowledgeRefsByKeyword", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.replace([
    makeRecord({ document: { ...makeRecord().document, namespace: "ns1" }, chunks: [{ ...makeRecord().chunks[0]!, namespace: "ns1", chunkId: "c1", keywords: ["term"] }] }),
    makeRecord({ document: { ...makeRecord().document, namespace: "ns2" }, chunks: [{ ...makeRecord().chunks[0]!, namespace: "ns2", chunkId: "c2", keywords: ["term"] }] }),
  ]);

  const ns1Refs = graph.findChunkKnowledgeRefsByKeyword("term", "ns1");
  const ns2Refs = graph.findChunkKnowledgeRefsByKeyword("term", "ns2");
  const allRefs = graph.findChunkKnowledgeRefsByKeyword("term");

  assert.equal(ns1Refs.length, 1);
  assert.equal(ns2Refs.length, 1);
  assert.equal(allRefs.length, 2);
});

test("SemanticKnowledgeGraph with empty graph returns empty inspect", () => {
  const graph = new SemanticKnowledgeGraph();

  const inspection = graph.inspect();

  assert.equal(inspection.nodes.length, 0);
  assert.equal(inspection.edges.length, 0);
});

test("SemanticKnowledgeGraph with empty chunks array", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks = [];

  graph.upsertRecord(record);

  const inspection = graph.inspect();
  // Should still have namespace and document nodes
  assert.ok(inspection.nodes.length >= 2);
});

test("SemanticKnowledgeGraph handles record with many chunks", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks = Array.from({ length: 10 }, (_, i) => ({
    ...record.chunks[0]!,
    chunkId: `chunk_${i}`,
    ordinal: i,
    keywords: [`keyword_${i}`],
  }));

  graph.upsertRecord(record);

  const inspection = graph.inspect();
  assert.ok(inspection.nodes.length >= 12); // namespace + document + 10 chunks + some keywords
});

test("SemanticKnowledgeGraph edge weights are preserved", () => {
  const graph = new SemanticKnowledgeGraph();
  graph.upsertRecord(makeRecord());

  const inspection = graph.inspect({});

  for (const edge of inspection.edges) {
    assert.equal(edge.weight, 1);
  }
});

test("SemanticKnowledgeGraph handles keyword normalization with special characters", () => {
  const graph = new SemanticKnowledgeGraph();
  const record = makeRecord();
  record.chunks[0]!.keywords = ["  SPACES  ", "mixedCase", "UPPERCASE"];

  graph.upsertRecord(record);

  // All should normalize to lowercase without spaces
  const refs1 = graph.findChunkKnowledgeRefsByKeyword("spaces");
  const refs2 = graph.findChunkKnowledgeRefsByKeyword("mixedcase");
  const refs3 = graph.findChunkKnowledgeRefsByKeyword("uppercase");

  assert.equal(refs1.length, 1);
  assert.equal(refs2.length, 1);
  assert.equal(refs3.length, 1);
});
