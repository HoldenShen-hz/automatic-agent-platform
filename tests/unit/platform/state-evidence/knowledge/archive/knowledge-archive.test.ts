import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeArchive } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import type { KnowledgeChunk, KnowledgeDocument, KnowledgeSource } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

function createMockKnowledgeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "src_1",
    type: "text",
    uri: "file:///test/path.txt",
    contentHash: "hash_1",
    metadata: {},
    ingestedAt: "2026-04-26T10:00:00Z",
    namespace: "test",
    language: "en",
    tags: [],
    trustLevel: "authoritative",
    freshnessTimestamp: "2026-04-26T10:00:00Z",
    checksum: "abc123",
    ...overrides,
  };
}

function createMockKnowledgeDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    documentId: "doc_1",
    sourceId: "src_1",
    title: "Test document",
    tags: [],
    domainScope: [],
    mimeType: "text/plain",
    namespace: "test",
    version: 1,
    status: "indexed",
    rawText: "This is test content",
    structuredText: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

function createMockKnowledgeChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    chunkId: "chunk_1",
    documentId: "doc_1",
    content: "This is test content",
    chunkType: "concept",
    tokenCount: 10,
    namespace: "test",
    ordinal: 0,
    summary: "Test summary",
    keywords: [],
    embeddingId: null,
    locator: {},
    embedding: [0.1, 0.2, 0.3],
    metadata: { relevantFiles: [] },
    ...overrides,
  };
}

test("KnowledgeArchive.upsert adds new record", () => {
  const archive = new KnowledgeArchive();
  const source = createMockKnowledgeSource({ checksum: "checksum_1" });
  const document = createMockKnowledgeDocument({ documentId: "doc_1" });
  const chunks = [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })];

  const record = { source, document, chunks };
  const result = archive.upsert(record);

  assert.equal(result.document.documentId, "doc_1");
  assert.equal(result.document.version, 1);
});

test("KnowledgeArchive.upsert is idempotent on same-checksum update", () => {
  const archive = new KnowledgeArchive();
  const source = createMockKnowledgeSource({ checksum: "checksum_1" });
  const document = createMockKnowledgeDocument({ documentId: "doc_1", version: 1 });
  const chunks = [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })];

  archive.upsert({ source, document, chunks });

  const updatedDocument = createMockKnowledgeDocument({ documentId: "doc_1", version: 1, rawText: "Updated content" });
  const updatedChunks = [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1", content: "Updated content" })];
  const result = archive.upsert({ source, document: updatedDocument, chunks: updatedChunks });

  assert.equal(result.document.version, 1);
  assert.notEqual(result.document.rawText, "Updated content");
  assert.equal(result.document.status, "indexed");
});

test("KnowledgeArchive.getDocument returns null for non-existent document", () => {
  const archive = new KnowledgeArchive();

  const result = archive.getDocument("non_existent");

  assert.equal(result, null);
});

test("KnowledgeArchive.getDocument returns record by documentId", () => {
  const archive = new KnowledgeArchive();
  const source = createMockKnowledgeSource({ checksum: "checksum_1" });
  const document = createMockKnowledgeDocument({ documentId: "doc_1" });
  const chunks = [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })];

  archive.upsert({ source, document, chunks });

  const result = archive.getDocument("doc_1");

  assert.ok(result);
  assert.equal(result!.document.documentId, "doc_1");
});

test("KnowledgeArchive.list returns all records when no namespace specified", () => {
  const archive = new KnowledgeArchive();

  archive.upsert({
    source: createMockKnowledgeSource({ checksum: "checksum_1" }),
    document: createMockKnowledgeDocument({ documentId: "doc_1", namespace: "ns1" }),
    chunks: [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })],
  });

  archive.upsert({
    source: createMockKnowledgeSource({ checksum: "checksum_2" }),
    document: createMockKnowledgeDocument({ documentId: "doc_2", namespace: "ns2" }),
    chunks: [createMockKnowledgeChunk({ chunkId: "chunk_2", documentId: "doc_2" })],
  });

  const results = archive.list();

  assert.equal(results.length, 2);
});

test("KnowledgeArchive.list filters by namespace", () => {
  const archive = new KnowledgeArchive();

  archive.upsert({
    source: createMockKnowledgeSource({ checksum: "checksum_1" }),
    document: createMockKnowledgeDocument({ documentId: "doc_1", namespace: "ns1" }),
    chunks: [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })],
  });

  archive.upsert({
    source: createMockKnowledgeSource({ checksum: "checksum_2" }),
    document: createMockKnowledgeDocument({ documentId: "doc_2", namespace: "ns2" }),
    chunks: [createMockKnowledgeChunk({ chunkId: "chunk_2", documentId: "doc_2" })],
  });

  const results = archive.list("ns1");

  assert.equal(results.length, 1);
  assert.equal(results[0]!.document.namespace, "ns1");
});

test("KnowledgeArchive.getChunk returns null for non-existent chunk", () => {
  const archive = new KnowledgeArchive();

  const result = archive.getChunk("non_existent");

  assert.equal(result, null);
});

test("KnowledgeArchive.getChunk returns record and chunk", () => {
  const archive = new KnowledgeArchive();
  const source = createMockKnowledgeSource({ checksum: "checksum_1" });
  const document = createMockKnowledgeDocument({ documentId: "doc_1" });
  const chunks = [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })];

  archive.upsert({ source, document, chunks });

  const result = archive.getChunk("chunk_1");

  assert.ok(result);
  assert.equal(result!.chunk.chunkId, "chunk_1");
  assert.equal(result!.record.document.documentId, "doc_1");
});

test("KnowledgeArchive.exportRecords returns all records", () => {
  const archive = new KnowledgeArchive();

  archive.upsert({
    source: createMockKnowledgeSource({ checksum: "checksum_1" }),
    document: createMockKnowledgeDocument({ documentId: "doc_1" }),
    chunks: [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })],
  });

  archive.upsert({
    source: createMockKnowledgeSource({ checksum: "checksum_2" }),
    document: createMockKnowledgeDocument({ documentId: "doc_2" }),
    chunks: [createMockKnowledgeChunk({ chunkId: "chunk_2", documentId: "doc_2" })],
  });

  const results = archive.exportRecords();

  assert.equal(results.length, 2);
});

test("KnowledgeArchive.replace clears and repopulates", () => {
  const archive = new KnowledgeArchive();

  archive.upsert({
    source: createMockKnowledgeSource({ checksum: "checksum_1" }),
    document: createMockKnowledgeDocument({ documentId: "doc_1" }),
    chunks: [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })],
  });

  const newRecords = [
    {
      source: createMockKnowledgeSource({ checksum: "checksum_new" }),
      document: createMockKnowledgeDocument({ documentId: "doc_new" }),
      chunks: [createMockKnowledgeChunk({ chunkId: "chunk_new", documentId: "doc_new" })],
    },
  ];

  archive.replace(newRecords);

  assert.equal(archive.list().length, 1);
  assert.ok(archive.getDocument("doc_new"));
  assert.equal(archive.getDocument("doc_1"), null);
});

test("KnowledgeArchive.upsert handles multiple chunks per document", () => {
  const archive = new KnowledgeArchive();
  const source = createMockKnowledgeSource({ checksum: "checksum_1" });
  const document = createMockKnowledgeDocument({ documentId: "doc_1" });
  const chunks = [
    createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" }),
    createMockKnowledgeChunk({ chunkId: "chunk_2", documentId: "doc_1" }),
    createMockKnowledgeChunk({ chunkId: "chunk_3", documentId: "doc_1" }),
  ];

  archive.upsert({ source, document, chunks });

  assert.ok(archive.getChunk("chunk_1"));
  assert.ok(archive.getChunk("chunk_2"));
  assert.ok(archive.getChunk("chunk_3"));
  assert.equal(archive.list().length, 1);
});

test("KnowledgeArchive.upsert preserves chunks when checksum is unchanged", () => {
  const archive = new KnowledgeArchive();
  const source = createMockKnowledgeSource({ checksum: "checksum_1" });
  const document = createMockKnowledgeDocument({ documentId: "doc_1" });
  const chunks = [
    createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" }),
    createMockKnowledgeChunk({ chunkId: "chunk_2", documentId: "doc_1" }),
  ];

  archive.upsert({ source, document, chunks });

  // Same checksum means the content has not changed, so upsert must be idempotent.
  const updatedChunks = [
    createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1", content: "Updated chunk 1" }),
    createMockKnowledgeChunk({ chunkId: "chunk_2", documentId: "doc_1", content: "Updated chunk 2" }),
    createMockKnowledgeChunk({ chunkId: "chunk_3", documentId: "doc_1", content: "New chunk 3" }),
  ];

  archive.upsert({
    source,
    document: { ...document, version: 1 },
    chunks: updatedChunks,
  });

  const result = archive.getChunk("chunk_3");
  assert.equal(result, null);
  assert.notEqual(archive.getChunk("chunk_1")!.chunk.content, "Updated chunk 1");
});
