import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeArchive } from "../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import type { ArchivedKnowledgeRecord } from "../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-archive.js";
import type { KnowledgeSource, KnowledgeDocument, KnowledgeChunk } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

function createMinimalSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "source_1",
    type: "file",
    uri: "file:///test/path",
    contentHash: "abc123",
    metadata: {},
    ingestedAt: "2026-01-01T00:00:00.000Z",
    namespace: "test",
    language: "en",
    tags: [],
    trustLevel: "authoritative",
    freshnessTimestamp: "2026-01-01T00:00:00.000Z",
    checksum: "checksum_1",
    ...overrides,
  };
}

function createMinimalDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    documentId: "doc_1",
    sourceId: "source_1",
    title: "Test Document",
    version: 1,
    tags: [],
    domainScope: [],
    status: "indexed",
    namespace: "test",
    mimeType: "text/plain",
    rawText: "Test content",
    structuredText: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

function createMinimalChunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    chunkId: "chunk_1",
    documentId: "doc_1",
    content: "Test chunk content",
    chunkType: "concept",
    metadata: { relevantFiles: [] },
    embedding: null,
    tokenCount: 10,
    namespace: "test",
    ordinal: 0,
    summary: "Test summary",
    keywords: [],
    embeddingId: null,
    locator: {},
    ...overrides,
  };
}

function createArchivedRecord(overrides: Partial<ArchivedKnowledgeRecord> = {}): ArchivedKnowledgeRecord {
  return {
    source: createMinimalSource(),
    document: createMinimalDocument(),
    chunks: [createMinimalChunk()],
    ...overrides,
  };
}

test("KnowledgeArchive upsert adds new record when checksum does not exist", () => {
  const archive = new KnowledgeArchive();
  const record = createArchivedRecord();

  const result = archive.upsert(record);

  assert.equal(result.document.documentId, "doc_1");
  assert.equal(result.document.version, 1);
});

test("KnowledgeArchive upsert is idempotent when checksum exists", () => {
  const archive = new KnowledgeArchive();
  const record1 = createArchivedRecord({
    source: createMinimalSource({ checksum: "same_checksum" }),
    document: createMinimalDocument({ documentId: "doc_1", version: 1 }),
    chunks: [createMinimalChunk({ chunkId: "chunk_1" })],
  });
  const record2 = createArchivedRecord({
    source: createMinimalSource({ checksum: "same_checksum" }),
    document: createMinimalDocument({ documentId: "doc_1", version: 1, rawText: "Updated content" }),
    chunks: [createMinimalChunk({ chunkId: "chunk_2" })],
  });

  archive.upsert(record1);
  const result = archive.upsert(record2);

  assert.equal(result.document.version, 1);
  assert.notEqual(result.document.rawText, "Updated content");
  assert.equal(result.document.status, "indexed");
  assert.equal(result.document.archived, false);
});

test("KnowledgeArchive upsert updates recordsByDocumentId map", () => {
  const archive = new KnowledgeArchive();
  const record = createArchivedRecord();

  archive.upsert(record);
  const retrieved = archive.getDocument("doc_1");

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.document.documentId, "doc_1");
});

test("KnowledgeArchive upsert updates recordsByChunkId map", () => {
  const archive = new KnowledgeArchive();
  const record = createArchivedRecord({
    chunks: [
      createMinimalChunk({ chunkId: "chunk_1" }),
      createMinimalChunk({ chunkId: "chunk_2" }),
    ],
  });

  archive.upsert(record);

  const chunk1 = archive.getChunk("chunk_1");
  const chunk2 = archive.getChunk("chunk_2");

  assert.ok(chunk1 !== null);
  assert.ok(chunk2 !== null);
  assert.equal(chunk1!.chunk.chunkId, "chunk_1");
  assert.equal(chunk2!.chunk.chunkId, "chunk_2");
});

test("KnowledgeArchive getDocument returns null for non-existent document", () => {
  const archive = new KnowledgeArchive();

  const result = archive.getDocument("non_existent");

  assert.equal(result, null);
});

test("KnowledgeArchive list returns all records when namespace is undefined", () => {
  const archive = new KnowledgeArchive();
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc_1", namespace: "ns1" }),
  }));
  archive.upsert(createArchivedRecord({
    source: createMinimalSource({ checksum: "checksum_2" }),
    document: createMinimalDocument({ documentId: "doc_2", namespace: "ns2" }),
  }));

  const result = archive.list();

  assert.equal(result.length, 2);
});

test("KnowledgeArchive list filters by namespace", () => {
  const archive = new KnowledgeArchive();
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc_1", namespace: "coding" }),
  }));
  archive.upsert(createArchivedRecord({
    source: createMinimalSource({ checksum: "checksum_2" }),
    document: createMinimalDocument({ documentId: "doc_2", namespace: "docs" }),
  }));

  const result = archive.list("coding");

  assert.equal(result.length, 1);
  assert.equal(result[0]!.document.namespace, "coding");
});

test("KnowledgeArchive list returns empty array when no records match namespace", () => {
  const archive = new KnowledgeArchive();
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ namespace: "coding" }),
  }));

  const result = archive.list("non_existent_namespace");

  assert.equal(result.length, 0);
});

test("KnowledgeArchive getChunk returns null for non-existent chunk", () => {
  const archive = new KnowledgeArchive();

  const result = archive.getChunk("non_existent");

  assert.equal(result, null);
});

test("KnowledgeArchive exportRecords returns all records", () => {
  const archive = new KnowledgeArchive();
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc_1" }),
  }));
  archive.upsert(createArchivedRecord({
    source: createMinimalSource({ checksum: "checksum_2" }),
    document: createMinimalDocument({ documentId: "doc_2" }),
  }));

  const result = archive.exportRecords();

  assert.equal(result.length, 2);
});

test("KnowledgeArchive replace clears existing records and adds new ones", () => {
  const archive = new KnowledgeArchive();
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc_old" }),
  }));

  const newRecords = [
    createArchivedRecord({
      source: createMinimalSource({ checksum: "new_checksum_1" }),
      document: createMinimalDocument({ documentId: "doc_new_1" }),
    }),
    createArchivedRecord({
      source: createMinimalSource({ checksum: "new_checksum_2" }),
      document: createMinimalDocument({ documentId: "doc_new_2" }),
    }),
  ];

  archive.replace(newRecords);

  const all = archive.list();
  assert.equal(all.length, 2);
  assert.equal(archive.getDocument("doc_old"), null);
  assert.ok(archive.getDocument("doc_new_1") !== null);
  assert.ok(archive.getDocument("doc_new_2") !== null);
});

test("KnowledgeArchive replace with empty array clears all records", () => {
  const archive = new KnowledgeArchive();
  archive.upsert(createArchivedRecord({
    document: createMinimalDocument({ documentId: "doc_1" }),
  }));

  archive.replace([]);

  const result = archive.list();
  assert.equal(result.length, 0);
});
