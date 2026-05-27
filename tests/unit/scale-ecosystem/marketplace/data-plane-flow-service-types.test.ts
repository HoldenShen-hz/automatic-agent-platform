import assert from "node:assert/strict";
import test from "node:test";

import type {
  CreateAnalyticsFactInput,
  CreateArchiveBundleInput,
  CreateReplayDatasetInput,
  StartDataMovementJobInput,
  CompleteDataMovementJobInput,
  DataPlaneSummaryInput,
  DataPlaneSummary,
  DataPlaneExportResult,
  DataPlaneFlowServiceOptions,
} from "../../../../src/scale-ecosystem/marketplace/data-plane-flow-service.js";
import type {
  DataNamespacePlane,
  DataMovementJobRecord,
  ArtifactRef,
} from "../../../../src/platform/contracts/types/domain.js";

test("CreateAnalyticsFactInput structure is correct [data-plane-flow-service-types]", () => {
  const input: CreateAnalyticsFactInput = {
    namespaceId: "ns_123",
    metricName: "task_completion",
    value: 1,
    windowStart: "2026-04-14T00:00:00.000Z",
    windowEnd: "2026-04-14T23:59:59.999Z",
    sourceRef: "worker_1",
    capturedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.equal(input.namespaceId, "ns_123");
  assert.equal(input.metricName, "task_completion");
  assert.equal(input.value, 1);
});

test("CreateAnalyticsFactInput allows optional metadata [data-plane-flow-service-types]", () => {
  const input: CreateAnalyticsFactInput = {
    namespaceId: "ns_456",
    metricName: "error_count",
    value: 5,
    windowStart: "2026-04-14T00:00:00.000Z",
    windowEnd: "2026-04-14T23:59:59.999Z",
    sourceRef: "worker_1",
    dimensions: { source: "worker_1" },
  };

  assert.deepEqual(input.dimensions, { source: "worker_1" });
});

test("CreateArchiveBundleInput structure is correct [data-plane-flow-service-types]", () => {
  const input: CreateArchiveBundleInput = {
    namespaceId: "ns_archive",
    bundleType: "memory_snapshot",
    sourceRefs: ["ref_1", "ref_2"],
    summaryRef: "summary_ref",
  };

  assert.equal(input.namespaceId, "ns_archive");
  assert.equal(input.bundleType, "memory_snapshot");
  assert.equal(input.sourceRefs.length, 2);
});

test("CreateArchiveBundleInput allows optional bundleId [data-plane-flow-service-types]", () => {
  const input: CreateArchiveBundleInput = {
    bundleId: "bundle_123",
    namespaceId: "ns_archive",
    bundleType: "task_archive",
    sourceRefs: ["ref_1"],
    summaryRef: "summary_ref",
  };

  assert.equal(input.bundleId, "bundle_123");
});

test("CreateReplayDatasetInput structure is correct [data-plane-flow-service-types]", () => {
  const input: CreateReplayDatasetInput = {
    namespaceId: "ns_replay",
    datasetType: "test_replay",
    sampleRefs: ["sample_1", "sample_2"],
    truthRefs: ["truth_1"],
    version: "1.0.0",
  };

  assert.equal(input.namespaceId, "ns_replay");
  assert.equal(input.datasetType, "test_replay");
  assert.equal(input.sampleRefs.length, 2);
  assert.equal(input.truthRefs.length, 1);
  assert.equal(input.version, "1.0.0");
});

test("StartDataMovementJobInput structure is correct [data-plane-flow-service-types]", () => {
  const input: StartDataMovementJobInput = {
    sourceNamespaceId: "ns_src",
    targetNamespaceId: "ns_tgt",
    movementType: "analytics_etl",
    inputRefs: ["ref_1", "ref_2"],
  };

  assert.equal(input.sourceNamespaceId, "ns_src");
  assert.equal(input.targetNamespaceId, "ns_tgt");
  assert.equal(input.movementType, "analytics_etl");
  assert.equal(input.inputRefs.length, 2);
});

test("StartDataMovementJobInput allows optional jobId [data-plane-flow-service-types]", () => {
  const input: StartDataMovementJobInput = {
    jobId: "job_123",
    sourceNamespaceId: "ns_src",
    targetNamespaceId: "ns_tgt",
    movementType: "artifact_lifecycle_move",
    inputRefs: ["ref_1"],
  };

  assert.equal(input.jobId, "job_123");
});

test("CompleteDataMovementJobInput structure is correct [data-plane-flow-service-types]", () => {
  const input: CompleteDataMovementJobInput = {
    jobId: "job_123",
    status: "completed",
  };

  assert.equal(input.jobId, "job_123");
  assert.equal(input.status, "completed");
});

test("CompleteDataMovementJobInput allows failure status [data-plane-flow-service-types]", () => {
  const input: CompleteDataMovementJobInput = {
    jobId: "job_456",
    status: "failed",
    report: { error: "Connection timeout" },
  };

  assert.equal(input.status, "failed");
  assert.deepEqual(input.report, { error: "Connection timeout" });
});

test("DataPlaneSummaryInput structure is correct [data-plane-flow-service-types]", () => {
  const input: DataPlaneSummaryInput = {
    tenantId: "tenant_123",
  };

  assert.equal(input.tenantId, "tenant_123");
});

test("DataPlaneSummaryInput allows empty input [data-plane-flow-service-types]", () => {
  const input: DataPlaneSummaryInput = {};
  assert.equal(input.tenantId, undefined);
});

test("DataPlaneSummary structure is correct [data-plane-flow-service-types]", () => {
  const summary: DataPlaneSummary = {
    reportId: "report_123",
    generatedAt: "2026-04-14T12:00:00.000Z",
    tenantId: "tenant_abc",
    namespacesByPlane: {
      transactional: 10,
      analytics: 5,
      memory_archive: 2,
      replay: 1,
      artifact: 3,
    },
    totals: {
      analyticsFacts: 5000,
      archiveBundles: 10,
      replayDatasets: 3,
      movementJobs: 7,
    },
    movementJobsByStatus: {
      pending: 1,
      running: 2,
      completed: 3,
      failed: 1,
      cancelled: 0,
    },
    recentJobs: [
      {
        jobId: "job_1",
        movementType: "analytics_etl",
        sourcePlane: "transactional",
        targetPlane: "analytics",
        status: "completed",
        tenantId: "tenant_abc",
        startedAt: "2026-04-14T00:00:00.000Z",
        finishedAt: "2026-04-14T01:00:00.000Z",
      },
    ],
  };

  assert.equal(summary.reportId, "report_123");
  assert.equal(summary.tenantId, "tenant_abc");
  assert.equal(summary.namespacesByPlane.transactional, 10);
  assert.equal(summary.totals.analyticsFacts, 5000);
  assert.equal(summary.recentJobs.length, 1);
});

test("DataPlaneExportResult structure is correct [data-plane-flow-service-types]", () => {
  const result: DataPlaneExportResult = {
    summary: {
      reportId: "report_export",
      generatedAt: "2026-04-14T12:00:00.000Z",
      tenantId: null,
      namespacesByPlane: {
        transactional: 1,
        analytics: 1,
        memory_archive: 0,
        replay: 0,
        artifact: 0,
      },
      totals: {
        analyticsFacts: 0,
        archiveBundles: 0,
        replayDatasets: 0,
        movementJobs: 0,
      },
      movementJobsByStatus: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      },
      recentJobs: [],
    },
    jsonArtifact: {
      artifactId: "art_json",
      kind: "file",
      uri: "file:///tmp/export.json",
      sizeBytes: 1024,
      createdAt: "2026-04-14T00:00:00.000Z",
    },
    markdownArtifact: {
      artifactId: "art_md",
      kind: "file",
      uri: "file:///tmp/export.md",
      sizeBytes: 512,
      createdAt: "2026-04-14T00:00:00.000Z",
    },
  };

  assert.equal(result.summary.reportId, "report_export");
  assert.equal(result.jsonArtifact.artifactId, "art_json");
  assert.equal(result.markdownArtifact.artifactId, "art_md");
});

test("DataPlaneFlowServiceOptions structure is correct [data-plane-flow-service-types]", () => {
  const options: DataPlaneFlowServiceOptions = {
    artifactStoreOptions: {
      rootDir: "/var/data-plane/artifacts",
    },
  };

  assert.ok(options.artifactStoreOptions !== undefined);
  assert.equal(options.artifactStoreOptions?.rootDir, "/var/data-plane/artifacts");
});

test("DataPlaneFlowServiceOptions allows empty options [data-plane-flow-service-types]", () => {
  const options: DataPlaneFlowServiceOptions = {};
  assert.equal(options.artifactStoreOptions, undefined);
});

test("DataNamespacePlane accepts all valid values [data-plane-flow-service-types]", () => {
  const planes: DataNamespacePlane[] = [
    "transactional",
    "analytics",
    "memory_archive",
    "replay",
    "artifact",
  ];

  for (const plane of planes) {
    assert.ok(planes.includes(plane));
  }
  assert.equal(planes.length, 5);
});
