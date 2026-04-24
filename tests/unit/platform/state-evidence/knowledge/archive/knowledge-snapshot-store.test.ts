import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { KnowledgeSnapshotStore } from "../../../../../../src/platform/state-evidence/knowledge/archive/knowledge-snapshot-store.js";
import type { ArchivedKnowledgeRecord } from "../../../../../../src/platform/state-evidence/knowledge/archive/knowledge-archive.js";
import type { KnowledgeNamespace, KnowledgeSource, KnowledgeDocument, KnowledgeChunk } from "../../../../../../src/platform/state-evidence/knowledge/knowledge-model.js";

// =============================================================================
// mock factories
// =============================================================================

function createMinimalSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: "source_1",
    type: "text",
    uri: "file:///test/path",
    contentHash: "abc123",
    metadata: {},
    ingestedAt: "2026-01-01T00:00:00.000Z",
    namespace: "test",
    language: "en",
    tags: [],
    trustLevel: "verified",
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

function createMinimalRecord(overrides: Partial<ArchivedKnowledgeRecord> = {}): ArchivedKnowledgeRecord {
  return {
    source: createMinimalSource(),
    document: createMinimalDocument(),
    chunks: [createMinimalChunk()],
    ...overrides,
  };
}

function createMinimalNamespace(overrides: Partial<KnowledgeNamespace> = {}): KnowledgeNamespace {
  return {
    namespaceId: "ns_001",
    path: "test.namespace",
    description: "Test namespace",
    ownerDomainId: "test-domain",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
    ...overrides,
  };
}

const SANDBOX_BASE = "/tmp/aa-sandbox";

// =============================================================================
// constructor - path validation
// =============================================================================

test("KnowledgeSnapshotStore rejects path with .. traversal", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/tmp/../etc/passwd" }),
    /path_traversal_denied/,
  );
});

test("KnowledgeSnapshotStore accepts absolute path under /tmp/aa-sandbox", () => {
  const sandboxPath = SANDBOX_BASE + "/test-snapshot-" + Date.now() + ".json";
  const store = new KnowledgeSnapshotStore({ snapshotPath: sandboxPath });
  assert.ok(store != null);
});

test("KnowledgeSnapshotStore accepts relative path", () => {
  const store = new KnowledgeSnapshotStore({
    snapshotPath: "test-snapshot.json",
  });
  assert.ok(store != null);
});

test("KnowledgeSnapshotStore rejects absolute path outside /tmp/aa-sandbox", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/etc/passwd" }),
    /path_scope_denied/,
  );
});

// =============================================================================
// load / save round-trip
// =============================================================================

test("KnowledgeSnapshotStore save and load returns identical snapshot", () => {
  const snapshotPath = SANDBOX_BASE + "/ktest-" + Date.now() + ".json";
  const store = new KnowledgeSnapshotStore({ snapshotPath });

  const namespaces = [createMinimalNamespace({ path: "test.ns" })];
  const records = [createMinimalRecord()];

  const saved = store.save({ namespaces, records });
  const loaded = store.load();

  assert.ok(loaded != null);
  assert.equal(loaded!.namespaces.length, 1);
  assert.equal(loaded!.records.length, 1);
  assert.equal(loaded!.namespaces[0]!.path, "test.ns");
  assert.equal(loaded!.records[0]!.document.documentId, "doc_1");
  assert.ok(loaded!.generatedAt != null);
});

test("KnowledgeSnapshotStore load returns null for non-existent file", () => {
  const store = new KnowledgeSnapshotStore({
    snapshotPath: SANDBOX_BASE + "/nonexistent-" + Date.now() + ".json",
  });

  const result = store.load();

  assert.equal(result, null);
});

test("KnowledgeSnapshotStore save creates intermediate directories", () => {
  const nestedDir = "nested-" + Date.now() + "-dir";
  const snapshotPath = join(SANDBOX_BASE, nestedDir, "deep", "path", "snapshot.json");
  const store = new KnowledgeSnapshotStore({ snapshotPath });

  const saved = store.save({ namespaces: [], records: [] });

  assert.ok(saved.generatedAt != null);
});

test("KnowledgeSnapshotStore save preserves readonly arrays", () => {
  const snapshotPath = SANDBOX_BASE + "/readonly-" + Date.now() + ".json";
  const store = new KnowledgeSnapshotStore({ snapshotPath });

  const namespaces: readonly KnowledgeNamespace[] = [createMinimalNamespace()];
  const records: readonly ArchivedKnowledgeRecord[] = [createMinimalRecord()];

  store.save({ namespaces, records });
  const loaded = store.load();

  assert.ok(loaded != null);
  assert.equal(loaded!.namespaces.length, 1);
  assert.equal(loaded!.records.length, 1);
});

test("KnowledgeSnapshotStore generatedAt timestamp is ISO format", () => {
  const snapshotPath = SANDBOX_BASE + "/timestamp-" + Date.now() + ".json";
  const store = new KnowledgeSnapshotStore({ snapshotPath });

  const saved = store.save({ namespaces: [], records: [] });

  // Should be parseable as a date
  const parsed = new Date(saved.generatedAt);
  assert.ok(!isNaN(parsed.getTime()));
});

test("KnowledgeSnapshotStore generatedAt is in UTC", () => {
  const snapshotPath = SANDBOX_BASE + "/utc-" + Date.now() + ".json";
  const store = new KnowledgeSnapshotStore({ snapshotPath });

  const saved = store.save({ namespaces: [], records: [] });

  assert.ok(saved.generatedAt.endsWith("Z"));
});
