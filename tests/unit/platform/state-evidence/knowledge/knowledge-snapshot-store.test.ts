/**
 * Unit tests for KnowledgeSnapshotStore
 *
 * Tests the file-based snapshot store for knowledge plane backup/restore.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { KnowledgeSnapshotStore } from "../../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-snapshot-store.js";
import type { KnowledgeNamespace } from "../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

function createTempPath(): string {
  return `${tmpdir()}/knaps-test-${randomUUID()}`;
}

function createTestNamespace(overrides?: Partial<KnowledgeNamespace>): KnowledgeNamespace {
  return {
    namespaceId: "ns-test-1",
    path: "/test/namespace",
    description: "Test namespace for unit testing",
    ownerDomainId: "domain-test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 100,
    maxTotalSizeBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

function createArchivedRecord(documentId: string, namespaceId: string, content: string) {
  return {
    source: {
      sourceId: `${documentId}-source`,
      type: "text" as const,
      uri: `memory://${documentId}`,
      contentHash: `${documentId}-hash`,
      metadata: {},
      ingestedAt: "2026-05-20T00:00:00.000Z",
      namespace: namespaceId,
      language: null,
      tags: [],
      trustLevel: "authoritative" as const,
      freshnessTimestamp: "2026-05-20T00:00:00.000Z",
      checksum: `${documentId}-checksum`,
    },
    document: {
      documentId,
      sourceId: `${documentId}-source`,
      title: `Document ${documentId}`,
      version: 1,
      tags: [],
      domainScope: [],
      status: "archived" as const,
      namespace: namespaceId,
      mimeType: "text/plain",
      rawText: content,
      structuredText: null,
      archived: true,
      archivedAt: "2026-05-20T00:00:00.000Z",
    },
    chunks: [{
      chunkId: `${documentId}-chunk-1`,
      documentId,
      content,
      chunkType: "concept" as const,
      metadata: { relevantFiles: [] },
      embedding: null,
      tokenCount: 3,
      namespace: namespaceId,
      ordinal: 0,
      summary: `Summary for ${documentId}`,
      keywords: [],
      embeddingId: null,
      locator: {},
    }],
  };
}

test("KnowledgeSnapshotStore rejects path traversal attempts", () => {
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/tmp/../etc/passwd" }),
    /path_traversal_denied/,
  );
});

test("KnowledgeSnapshotStore rejects absolute paths outside sandbox", () => {
  // Absolute paths not under /tmp/aa-sandbox/ should be rejected
  assert.throws(
    () => new KnowledgeSnapshotStore({ snapshotPath: "/etc/config.json" }),
    /path_scope_denied/,
  );
});

test("KnowledgeSnapshotStore accepts relative paths", () => {
  // Relative paths should be accepted (security check passes since no traversal)
  const store = new KnowledgeSnapshotStore({ snapshotPath: "relative/path/snapshot.json" });
  assert.ok(store);
});

test("KnowledgeSnapshotStore load returns null for non-existent file", () => {
  const store = new KnowledgeSnapshotStore({ snapshotPath: createTempPath() + "/nonexistent.json" });
  const result = store.load();
  assert.equal(result, null);
});

test("KnowledgeSnapshotStore save and load roundtrip", () => {
  const path = createTempPath();
  try {
    const store = new KnowledgeSnapshotStore({ snapshotPath: `${path}/snapshot.json` });

    const namespaces = [createTestNamespace(), createTestNamespace({ namespaceId: "ns-test-2" })];
    const records = [
      createArchivedRecord("knowledge-1", "ns-test-1", "Test knowledge content"),
      createArchivedRecord("knowledge-2", "ns-test-1", "More content"),
    ];

    const snapshot = store.save({ namespaces, records });

    assert.ok(snapshot);
    assert.equal(snapshot.namespaces.length, 2);
    assert.equal(snapshot.records.length, 2);
    assert.ok(snapshot.generatedAt);

    // Load and verify
    const loaded = store.load();
    assert.ok(loaded);
    assert.equal(loaded!.namespaces.length, 2);
    assert.equal(loaded!.records.length, 2);
    assert.equal(loaded!.namespaces[0]!.namespaceId, "ns-test-1");
    assert.equal(loaded!.records[0]!.document.documentId, "knowledge-1");
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test("KnowledgeSnapshotStore save creates parent directories", () => {
  const path = createTempPath();
  try {
    const nestedPath = `${path}/nested/deep/directories/snapshot.json`;
    const store = new KnowledgeSnapshotStore({ snapshotPath: nestedPath });

    store.save({ namespaces: [], records: [] });

    // Should not throw - directories created
    const loaded = store.load();
    assert.ok(loaded);
    assert.equal(loaded!.namespaces.length, 0);
    assert.equal(loaded!.records.length, 0);
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test("KnowledgeSnapshotStore save makes defensive copies of arrays", () => {
  const path = createTempPath();
  try {
    const store = new KnowledgeSnapshotStore({ snapshotPath: `${path}/snapshot.json` });

    const namespaces = [createTestNamespace({ namespaceId: "ns-orig" })];
    const records = [
      createArchivedRecord("k-1", "ns-orig", "Content"),
    ];

    store.save({ namespaces, records });

    // Modify original arrays - should not affect saved snapshot
    namespaces[0]!.namespaceId = "ns-modified";
    records[0]!.document.documentId = "k-modified";

    const loaded = store.load();
    assert.equal(loaded!.namespaces[0]!.namespaceId, "ns-orig");
    assert.equal(loaded!.records[0]!.document.documentId, "k-1");
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test("KnowledgeSnapshotStore preserves namespace fields correctly", () => {
  const path = createTempPath();
  try {
    const store = new KnowledgeSnapshotStore({ snapshotPath: `${path}/snapshot.json` });

    const namespace = createTestNamespace({
      namespaceId: "ns-detail",
      accessPolicy: "domain_only",
      trustLevel: "reviewed",
      freshnessPolicy: {
        maxAgeDays: 7,
        staleAction: "archive",
        refreshStrategy: "scheduled",
        refreshIntervalHours: 24,
      },
    });

    store.save({ namespaces: [namespace], records: [] });

    const loaded = store.load();
    assert.ok(loaded!.namespaces[0]!.namespaceId, "ns-detail");
    assert.equal(loaded!.namespaces[0]!.accessPolicy, "domain_only");
    assert.equal(loaded!.namespaces[0]!.trustLevel, "reviewed");
    assert.equal(loaded!.namespaces[0]!.freshnessPolicy!.refreshIntervalHours, 24);
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test("KnowledgeSnapshotStore handles empty arrays", () => {
  const path = createTempPath();
  try {
    const store = new KnowledgeSnapshotStore({ snapshotPath: `${path}/snapshot.json` });

    const snapshot = store.save({ namespaces: [], records: [] });

    assert.equal(snapshot.namespaces.length, 0);
    assert.equal(snapshot.records.length, 0);
    assert.ok(snapshot.generatedAt);

    const loaded = store.load();
    assert.ok(loaded);
    assert.equal(loaded!.namespaces.length, 0);
    assert.equal(loaded!.records.length, 0);
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test("KnowledgeSnapshotStore overwrites existing file on save", () => {
  const path = createTempPath();
  try {
    const store = new KnowledgeSnapshotStore({ snapshotPath: `${path}/snapshot.json` });

    store.save({
      namespaces: [createTestNamespace({ namespaceId: "ns-v1" })],
      records: [createArchivedRecord("k-v1", "ns-v1", "v1")],
    });

    store.save({
      namespaces: [createTestNamespace({ namespaceId: "ns-v2" })],
      records: [createArchivedRecord("k-v2", "ns-v2", "v2")],
    });

    const loaded = store.load();
    assert.equal(loaded!.namespaces[0]!.namespaceId, "ns-v2");
    assert.equal(loaded!.records[0]!.document.documentId, "k-v2");
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test("KnowledgeSnapshotStore generatedAt is valid ISO timestamp", () => {
  const path = createTempPath();
  try {
    const store = new KnowledgeSnapshotStore({ snapshotPath: `${path}/snapshot.json` });

    store.save({ namespaces: [], records: [] });

    const loaded = store.load();
    assert.ok(loaded!.generatedAt);
    // Should be parseable as a date
    const date = new Date(loaded!.generatedAt);
    assert.ok(!isNaN(date.getTime()));
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});
