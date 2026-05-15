import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeArchive } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import type { KnowledgeChunk, KnowledgeDocument, KnowledgeSource } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

function createMockKnowledgeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "src_1",
    sourceType: "document",
    checksum: "abc123",
    collectedAt: "2026-04-26T10:00:00Z",
    collectedBy: "collector_1",
    ...overrides,
  };
}

function createMockKnowledgeDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    documentId: "doc_1",
    namespace: "test",
    source: createMockKnowledgeSource(),
    version: 1,
    status: "indexed",
    rawText: "This is test content",
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
    embedding: [0.1, 0.2, 0.3],
    metadata: {},
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

test("KnowledgeArchive.upsert increments version on update", () => {
  const archive = new KnowledgeArchive();
  const source = createMockKnowledgeSource({ checksum: "checksum_1" });
  const document = createMockKnowledgeDocument({ documentId: "doc_1", version: 1 });
  const chunks = [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" })];

  archive.upsert({ source, document, chunks });

  const updatedDocument = createMockKnowledgeDocument({ documentId: "doc_1", version: 1, rawText: "Updated content" });
  const updatedChunks = [createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1", content: "Updated content" })];
  const result = archive.upsert({ source, document: updatedDocument, chunks: updatedChunks });

  assert.equal(result.document.version, 2);
  assert.equal(result.document.rawText, "Updated content");
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
  assert.equal(results[0].document.namespace, "ns1");
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

test("KnowledgeArchive.upsert updates chunks when document exists", () => {
  const archive = new KnowledgeArchive();
  const source = createMockKnowledgeSource({ checksum: "checksum_1" });
  const document = createMockKnowledgeDocument({ documentId: "doc_1" });
  const chunks = [
    createMockKnowledgeChunk({ chunkId: "chunk_1", documentId: "doc_1" }),
    createMockKnowledgeChunk({ chunkId: "chunk_2", documentId: "doc_1" }),
  ];

  archive.upsert({ source, document, chunks });

  // Update with new chunks
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
  assert.ok(result);
  assert.equal(result!.chunk.content, "New chunk 3");
});
