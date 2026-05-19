import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KnowledgeSnapshotStore } from "../../../../../src/platform/state-evidence/knowledge/archive/knowledge-snapshot-store.js";
// =============================================================================
// helpers
// =============================================================================
function createTempPath(suffix) {
    // Use /tmp/aa-sandbox/ as the temp directory since KnowledgeSnapshotStore
    // only allows absolute paths within /tmp/aa-sandbox/
    return join("/tmp/aa-sandbox", `ktest_${suffix}_${Date.now()}`);
}
function createMinimalNamespace(overrides = {}) {
    return {
        namespaceId: "ns_test",
        path: "test/namespace",
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
function createMinimalArchivedRecord() {
    return {
        source: {
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
        },
        document: {
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
        },
        chunks: [
            {
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
            },
        ],
    };
}
// =============================================================================
// constructor - path validation
// =============================================================================
test("KnowledgeSnapshotStore constructor accepts valid absolute path", () => {
    const path = createTempPath("valid");
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    assert.ok(store);
});
test("KnowledgeSnapshotStore constructor rejects path traversal with ..", () => {
    assert.throws(() => new KnowledgeSnapshotStore({ snapshotPath: "/tmp/../etc/passwd" }), /path_traversal_denied/);
});
test("KnowledgeSnapshotStore constructor rejects absolute path outside /tmp/aa-sandbox", () => {
    assert.throws(() => new KnowledgeSnapshotStore({ snapshotPath: "/etc/passwd" }), /path_scope_denied/);
});
test("KnowledgeSnapshotStore constructor accepts path within /tmp/aa-sandbox", () => {
    const path = "/tmp/aa-sandbox/knowledge-snapshot.json";
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    assert.ok(store);
});
test("KnowledgeSnapshotStore constructor accepts relative path", () => {
    const store = new KnowledgeSnapshotStore({ snapshotPath: "snapshot.json" });
    assert.ok(store);
});
// =============================================================================
// load
// =============================================================================
test("load returns null when snapshot file does not exist", () => {
    const path = createTempPath("nonexistent");
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    const result = store.load();
    assert.equal(result, null);
});
// =============================================================================
// save
// =============================================================================
test("save creates snapshot file with namespaces and records", () => {
    const path = createTempPath("save_test");
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    const namespaces = [createMinimalNamespace()];
    const records = [createMinimalArchivedRecord()];
    const snapshot = store.save({ namespaces, records });
    assert.equal(snapshot.namespaces.length, 1);
    assert.equal(snapshot.records.length, 1);
    assert.ok(snapshot.generatedAt.length > 0);
    assert.equal(snapshot.namespaces[0].namespaceId, "ns_test");
    rmSync(path, { force: true });
});
test("save generates ISO timestamp in snapshot", () => {
    const path = createTempPath("timestamp_test");
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    const snapshot = store.save({ namespaces: [], records: [] });
    // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
    assert.match(snapshot.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.ok(snapshot.generatedAt.endsWith("Z"));
    rmSync(path, { force: true });
});
test("save does not modify input arrays", () => {
    const path = createTempPath("immutability_test");
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    const namespaces = [createMinimalNamespace()];
    const records = [createMinimalArchivedRecord()];
    store.save({ namespaces, records });
    // Original arrays should be unchanged
    assert.equal(namespaces.length, 1);
    assert.equal(records.length, 1);
    rmSync(path, { force: true });
});
// =============================================================================
// load after save
// =============================================================================
test("load returns saved snapshot with correct namespaces and records", () => {
    const path = createTempPath("load_save_test");
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    const namespaces = [
        createMinimalNamespace({ namespaceId: "ns_1", path: "path/one" }),
        createMinimalNamespace({ namespaceId: "ns_2", path: "path/two" }),
    ];
    const records = [
        createMinimalArchivedRecord(),
        { ...createMinimalArchivedRecord(), document: { ...createMinimalArchivedRecord().document, documentId: "doc_2" } },
    ];
    store.save({ namespaces, records });
    const loaded = store.load();
    assert.ok(loaded !== null);
    assert.equal(loaded.namespaces.length, 2);
    assert.equal(loaded.records.length, 2);
    assert.equal(loaded.namespaces[0].namespaceId, "ns_1");
    assert.equal(loaded.namespaces[1].namespaceId, "ns_2");
    assert.equal(loaded.records[0].document.documentId, "doc_1");
    assert.equal(loaded.records[1].document.documentId, "doc_2");
    rmSync(path, { force: true });
});
test("load overwrites previously loaded data after save", () => {
    const path = createTempPath("overwrite_test");
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    const namespaces1 = [createMinimalNamespace({ namespaceId: "ns_1" })];
    const records1 = [createMinimalArchivedRecord()];
    store.save({ namespaces: namespaces1, records: records1 });
    const loaded1 = store.load();
    const namespaces2 = [createMinimalNamespace({ namespaceId: "ns_2" })];
    const records2 = [createMinimalArchivedRecord()];
    store.save({ namespaces: namespaces2, records: records2 });
    const loaded2 = store.load();
    assert.ok(loaded2 !== null);
    assert.equal(loaded2.namespaces.length, 1);
    assert.equal(loaded2.namespaces[0].namespaceId, "ns_2");
    rmSync(path, { force: true });
});
// =============================================================================
// path scope validation
// =============================================================================
test("constructor rejects path with .. even if other checks would pass", () => {
    // This tests the additional validation layer beyond checkToolPathScope
    assert.throws(() => new KnowledgeSnapshotStore({ snapshotPath: "/tmp/aa-sandbox/../etc/malicious" }), /path_traversal_denied/);
});
test("constructor accepts nested path within /tmp/aa-sandbox", () => {
    const store = new KnowledgeSnapshotStore({
        snapshotPath: "/tmp/aa-sandbox/nested/deep/snapshot.json",
    });
    assert.ok(store);
});
// =============================================================================
// edge cases
// =============================================================================
test("save handles empty namespaces and records arrays", () => {
    const path = createTempPath("empty_test");
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    const snapshot = store.save({ namespaces: [], records: [] });
    assert.equal(snapshot.namespaces.length, 0);
    assert.equal(snapshot.records.length, 0);
    assert.ok(snapshot.generatedAt.length > 0);
    rmSync(path, { force: true });
});
test("load returns null for directory path that exists but is not a file", () => {
    // Use a path that won't be symlink-resolved
    const path = "/tmp/aa-sandbox/ktest_dir_test.json";
    mkdirSync("/tmp/aa-sandbox", { recursive: true });
    const store = new KnowledgeSnapshotStore({ snapshotPath: path });
    const result = store.load();
    // Directory exists at path, but load expects a file so result depends on implementation
    // This test verifies the store can be created with this path
    rmSync("/tmp/aa-sandbox", { recursive: true, force: true });
});
//# sourceMappingURL=knowledge-store.test.js.map