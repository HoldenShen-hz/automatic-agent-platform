import assert from "node:assert/strict";
import test from "node:test";

import { FreshnessTracker } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/governance/freshness-tracker.js";
import type { KnowledgeSource, KnowledgeNamespace } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

function createTestSource(
  freshnessTimestamp: string,
  trustLevel: KnowledgeSource["trustLevel"] = "authoritative",
): KnowledgeSource {
  return {
    sourceId: "source_test",
    type: "file",
    uri: "file:///test/doc.md",
    contentHash: "abc123",
    metadata: {},
    ingestedAt: "2024-01-01T00:00:00.000Z",
    namespace: "test_namespace",
    language: "en",
    tags: [],
    trustLevel,
    freshnessTimestamp,
    checksum: "checksum123",
  };
}

function createTestNamespace(maxAgeDays: number, staleAction: KnowledgeNamespace["freshnessPolicy"]["staleAction"]): KnowledgeNamespace {
  return {
    namespaceId: "ns_test",
    path: "/test",
    description: "Test namespace",
    ownerDomainId: "coding",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays,
      staleAction,
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "authoritative",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  };
}

test("FreshnessTracker.assess returns not stale for fresh source", () => {
  const tracker = new FreshnessTracker();
  const now = new Date("2024-01-10T00:00:00.000Z");
  const source = createTestSource("2024-01-05T00:00:00.000Z");
  const namespace = createTestNamespace(10, "warn");

  const assessment = tracker.assess(source, namespace, now);

  assert.equal(assessment.stale, false);
  assert.equal(assessment.daysOld, 5);
  assert.equal(assessment.effectiveTrustLevel, "authoritative");
  assert.equal(assessment.action, null);
});

test("FreshnessTracker.assess returns stale when source exceeds maxAgeDays", () => {
  const tracker = new FreshnessTracker();
  const now = new Date("2024-01-20T00:00:00.000Z");
  const source = createTestSource("2024-01-01T00:00:00.000Z");
  const namespace = createTestNamespace(10, "demote");

  const assessment = tracker.assess(source, namespace, now);

  assert.equal(assessment.stale, true);
  assert.equal(assessment.daysOld, 19);
  assert.equal(assessment.action, "demote");
});

test("FreshnessTracker.assess degrades trustLevel from authoritative to official on stale authoritative source", () => {
  const tracker = new FreshnessTracker();
  const now = new Date("2024-01-20T00:00:00.000Z");
  const source = createTestSource("2024-01-01T00:00:00.000Z", "authoritative");
  const namespace = createTestNamespace(10, "warn");

  const assessment = tracker.assess(source, namespace, now);

  assert.equal(assessment.stale, true);
  assert.equal(assessment.effectiveTrustLevel, "official");
});

test("FreshnessTracker.assess does not degrade trustLevel for non-authoritative stale sources", () => {
  const tracker = new FreshnessTracker();
  const now = new Date("2024-01-20T00:00:00.000Z");
  const source = createTestSource("2024-01-01T00:00:00.000Z", "team_reviewed");
  const namespace = createTestNamespace(10, "warn");

  const assessment = tracker.assess(source, namespace, now);

  assert.equal(assessment.stale, true);
  assert.equal(assessment.effectiveTrustLevel, "team_reviewed");
});

test("FreshnessTracker.assess returns correct staleAction", () => {
  const tracker = new FreshnessTracker();
  const now = new Date("2024-01-20T00:00:00.000Z");
  const source = createTestSource("2024-01-01T00:00:00.000Z");
  const namespace = createTestNamespace(10, "archive");

  const assessment = tracker.assess(source, namespace, now);

  assert.equal(assessment.stale, true);
  assert.equal(assessment.action, "archive");
});

test("FreshnessTracker.assess handles exact boundary of maxAgeDays", () => {
  const tracker = new FreshnessTracker();
  const now = new Date("2024-01-11T00:00:00.000Z");
  const source = createTestSource("2024-01-01T00:00:00.000Z");
  const namespace = createTestNamespace(10, "warn");

  const assessment = tracker.assess(source, namespace, now);

  assert.equal(assessment.stale, false);
  assert.equal(assessment.daysOld, 10);
});

test("FreshnessTracker.assess handles source older than maxAgeDays by one day", () => {
  const tracker = new FreshnessTracker();
  const now = new Date("2024-01-12T00:00:00.000Z");
  const source = createTestSource("2024-01-01T00:00:00.000Z");
  const namespace = createTestNamespace(10, "warn");

  const assessment = tracker.assess(source, namespace, now);

  assert.equal(assessment.stale, true);
  assert.equal(assessment.daysOld, 11);
});

test("FreshnessTracker.assess returns zero daysOld for future timestamp (capped)", () => {
  const tracker = new FreshnessTracker();
  const now = new Date("2024-01-05T00:00:00.000Z");
  const source = createTestSource("2024-01-10T00:00:00.000Z"); // Future date
  const namespace = createTestNamespace(10, "warn");

  const assessment = tracker.assess(source, namespace, now);

  assert.equal(assessment.stale, false);
  assert.equal(assessment.daysOld, 0);
});

test("FreshnessTracker.assess uses default Date.now when no date provided", () => {
  const tracker = new FreshnessTracker();
  // Source from 5 days ago
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const source = createTestSource(fiveDaysAgo.toISOString());
  const namespace = createTestNamespace(10, "warn");

  const assessment = tracker.assess(source, namespace);

  assert.equal(assessment.stale, false);
  assert.ok(assessment.daysOld <= 5);
});
