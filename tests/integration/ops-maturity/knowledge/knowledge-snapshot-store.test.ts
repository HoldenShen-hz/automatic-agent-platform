import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { KnowledgeSnapshotStore } from "../../../../src/platform/five-plane-state-evidence/knowledge/archive/knowledge-snapshot-store.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

function makeNamespace(override = {}) {
  return {
    namespaceId: "ns-test-001",
    path: "/test/knowledge",
    description: "Test namespace",
    ownerDomainId: "engineering_ops",
    accessPolicy: "public" as const,
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn" as const,
      refreshStrategy: "manual" as const,
      refreshIntervalHours: null,
    },
    trustLevel: "verified" as const,
    maxDocuments: 100,
    maxTotalSizeBytes: 1024 * 1024,
    ...override,
  };
}

function makeRecord(override = {}) {
  return {
    source: {
      sourceId: "src-001",
      type: "file" as const,
      uri: "file:///test/doc.md",
      contentHash: "abc123",
      metadata: {},
      ingestedAt: "2026-04-01T00:00:00.000Z",
      namespace: "ns-test-001",
      language: null,
      tags: [],
      trustLevel: "verified" as const,
      freshnessTimestamp: "2026-04-01T00:00:00.000Z",
      checksum: "abc123",
    },
    document: {
      documentId: "doc-001",
      sourceId: "src-001",
      title: "Test Document",
      version: 1,
      tags: [],
      domainScope: [],
      status: "indexed" as const,
      namespace: "ns-test-001",
      mimeType: "text/markdown",
      rawText: "# Test",
      structuredText: null,
      archived: false,
      archivedAt: null,
    },
    chunks: [],
  };
}

test("integration: KnowledgeSnapshotStore saves and loads a knowledge snapshot", () => {
  const workspace = createTempWorkspace("aa-snapshot-save-");
  try {
    const snapshotPath = join(workspace, "snapshot.json");
    const store = new KnowledgeSnapshotStore({ snapshotPath });

    const input = {
      namespaces: [makeNamespace()],
      records: [makeRecord()],
    };

    const saved = store.save(input);

    assert.strictEqual(saved.namespaces.length, 1);
    assert.strictEqual(saved.namespaces[0].namespaceId, "ns-test-001");
    assert.strictEqual(saved.records.length, 1);
    assert.strictEqual(saved.records[0].document.documentId, "doc-001");
    assert.ok(saved.generatedAt, "should have generatedAt timestamp");

    const loaded = store.load();
    assert.ok(loaded !== null, "load should return snapshot");
    assert.strictEqual(loaded!.namespaces.length, 1);
    assert.strictEqual(loaded!.records.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: KnowledgeSnapshotStore returns null for non-existent path", () => {
  const workspace = createTempWorkspace("aa-snapshot-load-");
  try {
    const snapshotPath = join(workspace, "nonexistent", "snapshot.json");
    const store = new KnowledgeSnapshotStore({ snapshotPath });

    const loaded = store.load();
    assert.strictEqual(loaded, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: KnowledgeSnapshotStore overwrites existing snapshot", () => {
  const workspace = createTempWorkspace("aa-snapshot-overwrite-");
  try {
    const snapshotPath = join(workspace, "snapshot.json");
    const store = new KnowledgeSnapshotStore({ snapshotPath });

    store.save({
      namespaces: [makeNamespace({ namespaceId: "ns-first" })],
      records: [],
    });

    const first = store.load();
    assert.strictEqual(first!.namespaces[0].namespaceId, "ns-first");

    store.save({
      namespaces: [makeNamespace({ namespaceId: "ns-second" })],
      records: [],
    });

    const second = store.load();
    assert.strictEqual(second!.namespaces.length, 1);
    assert.strictEqual(second!.namespaces[0].namespaceId, "ns-second");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: KnowledgeSnapshotStore blocks path traversal via .. in path", () => {
  const workspace = createTempWorkspace("aa-snapshot-traversal-");
  try {
    // Use string concatenation so .. is not resolved by path.join
    const snapshotPath = workspace + "/valid/../malicious.json";

    assert.throws(
      () => new KnowledgeSnapshotStore({ snapshotPath }),
      (err) => {
        return err instanceof Error && err.message.includes("path_traversal_denied");
      },
      "should reject path traversal",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: KnowledgeSnapshotStore blocks path traversal via normalized path containing ..", () => {
  const workspace = createTempWorkspace("aa-snapshot-norm-traversal-");
  try {
    // Absolute path that would escape the sandbox when normalized
    const snapshotPath = "/tmp/aa-sandbox/../etc/malicious.json";

    assert.throws(
      () => new KnowledgeSnapshotStore({ snapshotPath }),
      (err) => {
        return err instanceof Error && err.message.includes("path_traversal_denied");
      },
      "should reject normalized path traversal",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: KnowledgeSnapshotStore blocks paths outside allowed scope", () => {
  // Paths outside /tmp/aa-sandbox/ and tmpdir should be rejected when absolute
  const workspace = createTempWorkspace("aa-snapshot-scope-");
  try {
    const snapshotPath = "/etc/system/malicious.json";

    assert.throws(
      () => new KnowledgeSnapshotStore({ snapshotPath }),
      (err) => {
        return err instanceof Error && err.message.includes("path_scope_denied");
      },
      "should reject paths outside allowed scope",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: KnowledgeSnapshotStore accepts relative paths within workspace", () => {
  const workspace = createTempWorkspace("aa-snapshot-relative-");
  try {
    // Relative path should be allowed (not absolute, no traversal)
    const snapshotPath = "snapshot.json";
    const store = new KnowledgeSnapshotStore({ snapshotPath });

    const saved = store.save({
      namespaces: [makeNamespace()],
      records: [],
    });

    assert.strictEqual(saved.namespaces.length, 1);
    assert.ok(store.load() !== null, "should be able to load saved snapshot");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: KnowledgeSnapshotStore accepts absolute paths within tmpdir", () => {
  const workspace = createTempWorkspace("aa-snapshot-tmpdir-");
  try {
    const snapshotPath = join(workspace, "snapshot.json");
    const store = new KnowledgeSnapshotStore({ snapshotPath });

    const saved = store.save({
      namespaces: [makeNamespace({ namespaceId: "ns-tmpdir" })],
      records: [],
    });

    assert.strictEqual(saved.namespaces[0].namespaceId, "ns-tmpdir");
    const loaded = store.load();
    assert.ok(loaded !== null);
    assert.strictEqual(loaded!.namespaces[0].namespaceId, "ns-tmpdir");
  } finally {
    cleanupPath(workspace);
  }
});
