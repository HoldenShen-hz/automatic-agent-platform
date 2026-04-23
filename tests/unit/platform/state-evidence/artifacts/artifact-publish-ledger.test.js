import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactPublishLedger } from "../../../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";

test("ArtifactPublishLedger can be instantiated without options", () => {
  const ledger = new ArtifactPublishLedger();
  assert.ok(ledger != null);
});

test("ArtifactPublishLedger can be instantiated with options", () => {
  const ledger = new ArtifactPublishLedger({ ledgerPath: "/tmp/test-ledger.json" });
  assert.ok(ledger != null);
});

test("record creates ledger entry from bundle", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [
      {
        artifactId: "artifact_1",
        taskId: "task_1",
        stepId: "step_1",
        agentRole: "builder",
        type: "source_code" as const,
        path: "/path",
        contentHash: "abc",
        version: 1,
        parentArtifactId: null,
        size: 100,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: "draft" as const,
      },
    ],
    links: [],
    finalDeliverables: ["artifact_1"],
    totalSize: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "published" as const,
    publishedAt: "2026-01-02T00:00:00.000Z",
  };
  const entry = ledger.record(bundle);
  assert.ok(entry.publishId.startsWith("artifact_publish_"), `Expected publishId to start with artifact_publish_, got: ${entry.publishId}`);
  assert.equal(entry.bundleId, "bundle_1");
  assert.equal(entry.taskId, "task_1");
  assert.equal(entry.domainId, "domain_1");
  assert.equal(entry.bundleType, "release_bundle");
  assert.equal(entry.artifactCount, 1);
  assert.equal(entry.totalSize, 100);
});

test("record accepts optional target and destination", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "published" as const,
    publishedAt: "2026-01-02T00:00:00.000Z",
  };
  const entry = ledger.record(bundle, { target: "git", destination: "github.com/repo" });
  assert.equal(entry.target, "git");
  assert.equal(entry.destination, "github.com/repo");
});

test("list returns entries recorded in memory", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "published" as const,
    publishedAt: "2026-01-02T00:00:00.000Z",
  };
  ledger.record(bundle);
  ledger.record(bundle);
  const entries = ledger.list();
  assert.equal(entries.length, 2);
});

test("list returns empty array when no entries recorded", () => {
  const ledger = new ArtifactPublishLedger();
  const entries = ledger.list();
  assert.deepEqual(entries, []);
});

test("record sets publishStatus from bundle", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "published" as const,
    publishedAt: "2026-01-02T00:00:00.000Z",
  };
  const entry = ledger.record(bundle);
  assert.equal(entry.publishStatus, "published");
});

test("record uses bundle publishedAt when available", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "published" as const,
    publishedAt: "2026-01-15T12:30:00.000Z",
  };
  const entry = ledger.record(bundle);
  assert.equal(entry.publishedAt, "2026-01-15T12:30:00.000Z");
});

test("record defaults target and destination to null when not provided", () => {
  const ledger = new ArtifactPublishLedger();
  const bundle = {
    bundleId: "bundle_1",
    taskId: "task_1",
    artifacts: [],
    links: [],
    finalDeliverables: [],
    totalSize: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    bundleType: "release_bundle" as const,
    domainId: "domain_1",
    publishStatus: "published" as const,
    publishedAt: "2026-01-02T00:00:00.000Z",
  };
  const entry = ledger.record(bundle);
  assert.equal(entry.target, null);
  assert.equal(entry.destination, null);
});