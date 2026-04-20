import assert from "node:assert/strict";
import test from "node:test";

import type {
  AnalyticsFactRecord,
  ArchiveBundleRecord,
  ReplayDatasetRecord,
  DataMovementJobRecord,
  IntelItemRecord,
  IntelBriefRecord,
} from "../../../../../../src/platform/contracts/types/domain/data-types.js";
import type {
  DataNamespacePlane,
  PerceptionSourceType,
} from "../../../../../../src/platform/contracts/types/domain/primitives.js";

test("AnalyticsFactRecord structure is correct", () => {
  const record: AnalyticsFactRecord = {
    factId: "fact_123",
    namespaceId: "ns_456",
    tenantId: "tenant_789",
    organizationId: "org_abc",
    workspaceId: "ws_def",
    metricName: "tasks_completed",
    dimensionJson: '{"region":"us-east"}',
    value: 1500,
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-14T00:00:00.000Z",
    sourceRef: "task_tracker",
    capturedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.factId, "fact_123");
  assert.equal(record.metricName, "tasks_completed");
  assert.equal(record.value, 1500);
});

test("AnalyticsFactRecord allows null optional fields", () => {
  const record: AnalyticsFactRecord = {
    factId: "fact_min",
    namespaceId: "ns_min",
    tenantId: null,
    organizationId: null,
    workspaceId: null,
    metricName: "api_calls",
    dimensionJson: "{}",
    value: 500,
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-14T00:00:00.000Z",
    sourceRef: "api_gateway",
    capturedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.tenantId, null);
  assert.equal(record.workspaceId, null);
});

test("ArchiveBundleRecord structure is correct", () => {
  const record: ArchiveBundleRecord = {
    bundleId: "bundle_123",
    namespaceId: "ns_456",
    tenantId: "tenant_789",
    organizationId: "org_abc",
    workspaceId: "ws_def",
    bundleType: "task_archive",
    sourceRefsJson: '["task_1","task_2","task_3"]',
    summaryRef: "s3://archive/summary_123",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  assert.equal(record.bundleId, "bundle_123");
  assert.equal(record.bundleType, "task_archive");
  assert.equal(record.workspaceId, "ws_def");
});

test("ArchiveBundleRecord allows null tenantId", () => {
  const record: ArchiveBundleRecord = {
    bundleId: "bundle_system",
    namespaceId: "ns_system",
    tenantId: null,
    organizationId: null,
    workspaceId: null,
    bundleType: "system_backup",
    sourceRefsJson: "[]",
    summaryRef: "s3://system/bundle_123",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.tenantId, null);
  assert.equal(record.workspaceId, null);
});

test("ReplayDatasetRecord structure is correct", () => {
  const record: ReplayDatasetRecord = {
    datasetId: "dataset_123",
    namespaceId: "ns_456",
    tenantId: "tenant_789",
    organizationId: "org_abc",
    workspaceId: "ws_def",
    datasetType: "task_replay",
    sampleRefsJson: '["sample_1","sample_2"]',
    truthRefsJson: '["truth_1","truth_2"]',
    version: "v1.0.0",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  assert.equal(record.datasetId, "dataset_123");
  assert.equal(record.datasetType, "task_replay");
  assert.equal(record.version, "v1.0.0");
});

test("ReplayDatasetRecord allows null optional fields", () => {
  const record: ReplayDatasetRecord = {
    datasetId: "dataset_min",
    namespaceId: "ns_min",
    tenantId: null,
    organizationId: null,
    workspaceId: null,
    datasetType: "eval_dataset",
    sampleRefsJson: "[]",
    truthRefsJson: "[]",
    version: "v0.1.0",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.tenantId, null);
});

test("DataMovementJobRecord structure is correct", () => {
  const record: DataMovementJobRecord = {
    jobId: "job_123",
    tenantId: "tenant_456",
    organizationId: "org_789",
    workspaceId: "ws_abc",
    sourceNamespaceId: "ns_source",
    targetNamespaceId: "ns_target",
    sourcePlane: "transactional",
    targetPlane: "analytics",
    movementType: "analytics_etl",
    inputRefsJson: '["ref_1","ref_2"]',
    status: "running",
    startedAt: "2026-04-14T00:00:00.000Z",
    finishedAt: null,
    reportJson: null,
  };
  assert.equal(record.jobId, "job_123");
  assert.equal(record.movementType, "analytics_etl");
  assert.equal(record.status, "running");
});

test("DataMovementJobRecord allows completed status", () => {
  const record: DataMovementJobRecord = {
    jobId: "job_completed",
    tenantId: "tenant_completed",
    organizationId: null,
    workspaceId: null,
    sourceNamespaceId: "ns_src",
    targetNamespaceId: "ns_tgt",
    sourcePlane: "artifact",
    targetPlane: "memory_archive",
    movementType: "archive_compaction",
    inputRefsJson: "{}",
    status: "completed",
    startedAt: "2026-04-14T00:00:00.000Z",
    finishedAt: "2026-04-14T01:00:00.000Z",
    reportJson: '{"recordsMoved":1000}',
  };
  assert.equal(record.status, "completed");
  assert.ok(record.finishedAt !== null);
  assert.ok(record.reportJson !== null);
});

test("DataMovementJobRecord allows failed status", () => {
  const record: DataMovementJobRecord = {
    jobId: "job_failed",
    tenantId: "tenant_failed",
    organizationId: null,
    workspaceId: null,
    sourceNamespaceId: "ns_fail_src",
    targetNamespaceId: "ns_fail_tgt",
    sourcePlane: "replay",
    targetPlane: "analytics",
    movementType: "replay_dataset_build",
    inputRefsJson: "[]",
    status: "failed",
    startedAt: "2026-04-14T00:00:00.000Z",
    finishedAt: "2026-04-14T00:05:00.000Z",
    reportJson: '{"error":"source_unavailable"}',
  };
  assert.equal(record.status, "failed");
});

test("DataMovementJobRecord movementType accepts all values", () => {
  const types: DataMovementJobRecord["movementType"][] = [
    "analytics_etl",
    "archive_compaction",
    "replay_dataset_build",
    "artifact_lifecycle_move",
  ];
  assert.equal(types.length, 4);
});

test("DataMovementJobRecord status accepts all values", () => {
  const statuses: DataMovementJobRecord["status"][] = [
    "pending",
    "running",
    "completed",
    "failed",
    "cancelled",
  ];
  assert.equal(statuses.length, 5);
});

test("IntelItemRecord structure is correct", () => {
  const record: IntelItemRecord = {
    intelId: "intel_123",
    tenantId: "tenant_456",
    sourceId: "source_789",
    title: "Market trend analysis",
    summary: "AI market growing 25% annually",
    rawRef: "s3://intel/raw_123",
    relevanceScore: 0.85,
    importance: 7,
    tagsJson: '["AI","market","growth"]',
    dedupeKey: "market_trend_2026",
    capturedAt: "2026-04-14T00:00:00.000Z",
    expiresAt: "2026-05-14T00:00:00.000Z",
  };
  assert.equal(record.intelId, "intel_123");
  assert.equal(record.relevanceScore, 0.85);
  assert.equal(record.importance, 7);
});

test("IntelItemRecord allows null tenantId and expiresAt", () => {
  const record: IntelItemRecord = {
    intelId: "intel_min",
    tenantId: null,
    sourceId: "source_min",
    title: "Min intel",
    summary: "Minimal intel item",
    rawRef: "memory://intel_min",
    relevanceScore: 0.5,
    importance: 3,
    tagsJson: "[]",
    dedupeKey: "min_dedupe_key",
    capturedAt: "2026-04-14T00:00:00.000Z",
    expiresAt: null,
  };
  assert.equal(record.tenantId, null);
  assert.equal(record.expiresAt, null);
});

test("IntelBriefRecord structure is correct", () => {
  const record: IntelBriefRecord = {
    briefId: "brief_123",
    tenantId: "tenant_456",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-14T00:00:00.000Z",
    sourceScopeJson: '{"sources":["rss","web"]}',
    itemIdsJson: '["intel_1","intel_2","intel_3"]',
    overallSummary: "Weekly AI market digest",
    recommendedActionsJson: '["action_1","action_2"]',
    generatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.briefId, "brief_123");
  assert.equal(record.overallSummary, "Weekly AI market digest");
});

test("IntelBriefRecord allows null tenantId", () => {
  const record: IntelBriefRecord = {
    briefId: "brief_system",
    tenantId: null,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-14T00:00:00.000Z",
    sourceScopeJson: "{}",
    itemIdsJson: "[]",
    overallSummary: "System digest",
    recommendedActionsJson: "[]",
    generatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.tenantId, null);
});
