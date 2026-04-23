import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactPublishLedger } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";
function createMockBundle(overrides = {}) {
    const now = new Date().toISOString();
    return {
        bundleId: "bundle_001",
        taskId: "task_001",
        artifacts: [],
        links: [],
        finalDeliverables: [],
        totalSize: 1024,
        createdAt: now,
        bundleType: "release_bundle",
        domainId: "domain_001",
        publishStatus: "draft",
        publishedAt: null,
        ...overrides,
    };
}
test("ArtifactPublishLedger records entry on publish", () => {
    const ledger = new ArtifactPublishLedger();
    const bundle = createMockBundle();
    const entry = ledger.record(bundle);
    assert.equal(entry.bundleId, "bundle_001");
    assert.equal(entry.taskId, "task_001");
    assert.equal(entry.domainId, "domain_001");
    assert.equal(entry.artifactCount, 0);
    assert.equal(entry.totalSize, 1024);
    assert.equal(entry.publishStatus, "draft");
});
test("ArtifactPublishLedger records with target and destination metadata", () => {
    const ledger = new ArtifactPublishLedger();
    const bundle = createMockBundle();
    const entry = ledger.record(bundle, { target: "git", destination: "github.com/repo" });
    assert.equal(entry.target, "git");
    assert.equal(entry.destination, "github.com/repo");
});
test("ArtifactPublishLedger records with null target and destination when not provided", () => {
    const ledger = new ArtifactPublishLedger();
    const bundle = createMockBundle();
    const entry = ledger.record(bundle);
    assert.equal(entry.target, null);
    assert.equal(entry.destination, null);
});
test("ArtifactPublishLedger lists all recorded entries", () => {
    const ledger = new ArtifactPublishLedger();
    const bundle1 = createMockBundle({ bundleId: "bundle_001" });
    const bundle2 = createMockBundle({ bundleId: "bundle_002" });
    ledger.record(bundle1);
    ledger.record(bundle2);
    const entries = ledger.list();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].bundleId, "bundle_001");
    assert.equal(entries[1].bundleId, "bundle_002");
});
test("ArtifactPublishLedger generates unique publish IDs", () => {
    const ledger = new ArtifactPublishLedger();
    const bundle1 = createMockBundle({ bundleId: "bundle_001" });
    const bundle2 = createMockBundle({ bundleId: "bundle_002" });
    const entry1 = ledger.record(bundle1);
    const entry2 = ledger.record(bundle2);
    assert.notEqual(entry1.publishId, entry2.publishId);
});
test("ArtifactPublishLedger uses bundle publishedAt when available", () => {
    const ledger = new ArtifactPublishLedger();
    const publishedAt = "2024-01-15T10:00:00.000Z";
    const bundle = createMockBundle({ publishedAt, publishStatus: "published" });
    const entry = ledger.record(bundle);
    assert.equal(entry.publishedAt, publishedAt);
    assert.equal(entry.publishStatus, "published");
});
test("ArtifactPublishLedger uses nowIso when publishedAt is null", () => {
    const ledger = new ArtifactPublishLedger();
    const bundle = createMockBundle({ publishedAt: null });
    const before = new Date().toISOString();
    const entry = ledger.record(bundle);
    const after = new Date().toISOString();
    assert.ok(entry.publishedAt >= before);
    assert.ok(entry.publishedAt <= after);
});
test("ArtifactPublishLedger records artifact count from bundle", () => {
    const ledger = new ArtifactPublishLedger();
    const bundle = createMockBundle({
        artifacts: [
            { artifactId: "a1", taskId: "t1", stepId: "s1", agentRole: "agent", type: "source_code", path: "/a", contentHash: "h1", version: 1, parentArtifactId: null, size: 100, createdAt: "", status: "draft" },
            { artifactId: "a2", taskId: "t1", stepId: "s1", agentRole: "agent", type: "config", path: "/b", contentHash: "h2", version: 1, parentArtifactId: null, size: 200, createdAt: "", status: "draft" },
        ],
    });
    const entry = ledger.record(bundle);
    assert.equal(entry.artifactCount, 2);
});
test("ArtifactPublishLedger records totalSize from bundle", () => {
    const ledger = new ArtifactPublishLedger();
    const bundle = createMockBundle({ totalSize: 5000 });
    const entry = ledger.record(bundle);
    assert.equal(entry.totalSize, 5000);
});
test("ArtifactPublishLedger stores all bundleType values", () => {
    const ledger = new ArtifactPublishLedger();
    const bundleTypes = [
        "release_bundle",
        "asset_bundle",
        "campaign_bundle",
        "incident_bundle",
        "workflow_snapshot",
    ];
    for (const bundleType of bundleTypes) {
        const bundle = createMockBundle({ bundleType });
        const entry = ledger.record(bundle);
        assert.equal(entry.bundleType, bundleType);
    }
});
test("ArtifactPublishLedger stores all publishStatus values", () => {
    const ledger = new ArtifactPublishLedger();
    const statuses = ["draft", "review", "published", "recalled"];
    for (const status of statuses) {
        const bundle = createMockBundle({ publishStatus: status });
        const entry = ledger.record(bundle);
        assert.equal(entry.publishStatus, status);
    }
});
//# sourceMappingURL=artifact-publish-ledger.test.js.map