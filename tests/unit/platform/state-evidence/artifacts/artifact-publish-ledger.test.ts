import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactPublishLedger, type ArtifactPublishLedgerEntry } from "../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";
import type { ArtifactBundleExtended } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";

function createMockBundle(overrides: Partial<ArtifactBundleExtended> = {}): ArtifactBundleExtended {
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
  assert.equal(entries[0]!.bundleId, "bundle_001");
  assert.equal(entries[1]!.bundleId, "bundle_002");
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
      { artifactId: "a1", taskId: "t1", stepId: "s1", agentRole: "agent", type: "source_code", path: "/a", contentHash: "h1", version: 1, parentArtifactId: null, size: 100, createdAt: "", status: "draft" } as any,
      { artifactId: "a2", taskId: "t1", stepId: "s1", agentRole: "agent", type: "config", path: "/b", contentHash: "h2", version: 1, parentArtifactId: null, size: 200, createdAt: "", status: "draft" } as any,
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
  const bundleTypes: ArtifactBundleExtended["bundleType"][] = [
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
  const statuses: ArtifactBundleExtended["publishStatus"][] = ["draft", "review", "published", "recalled"];

  for (const status of statuses) {
    const bundle = createMockBundle({ publishStatus: status });
    const entry = ledger.record(bundle);
    assert.equal(entry.publishStatus, status);
  }
});

test("ArtifactPublishLedger list() returns copy of entries array", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = createMockBundle();
  ledger.record(bundle);

  const entries1 = ledger.list();
  const entries2 = ledger.list();

  entries1.push({} as ArtifactPublishLedgerEntry);

  assert.equal(entries2.length, 1);
});

test("ArtifactPublishLedger list() returns empty array when no entries recorded", () => {
  const ledger = new ArtifactPublishLedger();
  const entries = ledger.list();
  assert.equal(entries.length, 0);
});

test("ArtifactPublishLedger record() accepts null target and destination explicitly", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = createMockBundle();

  const entry = ledger.record(bundle, { target: null, destination: null });

  assert.equal(entry.target, null);
  assert.equal(entry.destination, null);
});

test("ArtifactPublishLedger record() preserves bundleType from bundle", () => {
  const ledger = new ArtifactPublishLedger();

  for (const bundleType of ["release_bundle", "asset_bundle", "campaign_bundle", "incident_bundle", "workflow_snapshot"] as const) {
    const bundle = createMockBundle({ bundleType });
    const entry = ledger.record(bundle);
    assert.equal(entry.bundleType, bundleType);
  }
});

test("ArtifactPublishLedger record() sets publishId with correct prefix", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = createMockBundle();

  const entry = ledger.record(bundle);

  assert.ok(entry.publishId.startsWith("artifact_publish_"));
});

test("ArtifactPublishLedger record() returns entry with all required fields", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = createMockBundle({ bundleId: "test_bundle", taskId: "test_task", domainId: "test_domain" });

  const entry = ledger.record(bundle);

  assert.ok(entry.publishId.length > 0);
  assert.equal(entry.bundleId, "test_bundle");
  assert.equal(entry.taskId, "test_task");
  assert.equal(entry.domainId, "test_domain");
  assert.ok(typeof entry.artifactCount === "number");
  assert.ok(typeof entry.totalSize === "number");
  assert.ok(entry.publishedAt.length > 0);
  assert.ok(entry.publishStatus.length > 0);
});
