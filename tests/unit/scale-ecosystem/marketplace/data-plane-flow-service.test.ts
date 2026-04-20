import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DataPlaneFlowService } from "../../../../src/scale-ecosystem/marketplace/data-plane-flow-service.js";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "data-plane-flow.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const tenantPlatform = new TenantPlatformService(db, store);
  const service = new DataPlaneFlowService(db, store, {
    artifactStoreOptions: {
      rootDir: join(workspace, "artifacts"),
    },
  });
  return { workspace, db, store, tenantPlatform, service };
}

test("DataPlaneFlowService creates tenant-aware analytics/archive/replay objects and movement summary", () => {
  const harness = createHarness("aa-data-plane-unit-");
  try {
    const organization = harness.tenantPlatform.createOrganization({
      organizationId: "org-data",
      displayName: "Data Org",
    });
    const workspace = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-data",
      ownerId: "user-data",
      displayName: "Data Workspace",
      planId: "enterprise",
      organizationId: organization.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-data",
      organizationId: organization.organizationId,
      storageScope: "tenant-data.storage",
      identityScope: "tenant-data.identity",
      policyScope: "tenant-data.policy",
      artifactScope: "tenant-data.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn",
      plane: "transactional",
      tenantId: tenant.tenantId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "txn_30d",
      encryptionPolicy: "kms:tenant-data",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-analytics",
      plane: "analytics",
      tenantId: tenant.tenantId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "analytics_180d",
      encryptionPolicy: "kms:tenant-data",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-archive",
      plane: "memory_archive",
      tenantId: tenant.tenantId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "archive_365d",
      encryptionPolicy: "kms:tenant-data",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-replay",
      plane: "replay",
      tenantId: tenant.tenantId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "replay_90d",
      encryptionPolicy: "kms:tenant-data",
    });

    const fact = harness.service.createAnalyticsFact({
      factId: "fact-1",
      namespaceId: "ns-analytics",
      metricName: "task_success_rate",
      dimensions: { division: "ops", window: "daily" },
      value: 0.98,
      windowStart: "2026-04-08T00:00:00.000Z",
      windowEnd: "2026-04-08T23:59:59.000Z",
      sourceRef: "task:daily-rollup",
    });
    const bundle = harness.service.createArchiveBundle({
      bundleId: "bundle-1",
      namespaceId: "ns-archive",
      bundleType: "handover_bundle",
      sourceRefs: ["artifact:alpha", "artifact:beta"],
      summaryRef: "artifact:summary",
    });
    const dataset = harness.service.createReplayDataset({
      datasetId: "dataset-1",
      namespaceId: "ns-replay",
      datasetType: "golden_regression",
      sampleRefs: ["sample:1", "sample:2"],
      truthRefs: ["truth:1"],
      version: "v1",
    });
    const movementJob = harness.service.startMovementJob({
      jobId: "move-1",
      sourceNamespaceId: "ns-txn",
      targetNamespaceId: "ns-analytics",
      movementType: "analytics_etl",
      inputRefs: ["task:1", "task:2"],
    });
    const completedJob = harness.service.completeMovementJob({
      jobId: movementJob.jobId,
      report: {
        movedFacts: 2,
        verdict: "pass",
      },
    });

    assert.equal(fact.tenantId, tenant.tenantId);
    assert.equal(bundle.organizationId, organization.organizationId);
    assert.equal(dataset.workspaceId, workspace.workspaceId);
    assert.equal(completedJob.status, "completed");
    assert.match(completedJob.reportJson ?? "", /"movedFacts":2/);

    const summary = harness.service.buildSummary({
      tenantId: tenant.tenantId,
      generatedAt: "2026-04-08T12:00:00.000Z",
    });
    assert.equal(summary.tenantId, tenant.tenantId);
    assert.equal(summary.namespacesByPlane.transactional, 1);
    assert.equal(summary.namespacesByPlane.analytics, 1);
    assert.equal(summary.namespacesByPlane.memory_archive, 1);
    assert.equal(summary.namespacesByPlane.replay, 1);
    assert.equal(summary.totals.analyticsFacts, 1);
    assert.equal(summary.totals.archiveBundles, 1);
    assert.equal(summary.totals.replayDatasets, 1);
    assert.equal(summary.totals.movementJobs, 1);
    assert.equal(summary.movementJobsByStatus.completed, 1);
    assert.equal(summary.recentJobs[0]?.jobId, "move-1");

    const exported = harness.service.exportSummary({
      tenantId: tenant.tenantId,
      generatedAt: "2026-04-08T12:00:00.000Z",
    });
    assert.equal(exported.summary.totals.movementJobs, 1);
    assert.equal(exported.jsonArtifact.kind, "data_plane_summary");
    assert.equal(exported.markdownArtifact.kind, "data_plane_summary_markdown");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService tracks movement jobs across multiple statuses", () => {
  const harness = createHarness("aa-data-plane-multi-");
  try {
    const org = harness.tenantPlatform.createOrganization({
      organizationId: "org-multi",
      displayName: "Multi Org",
    });
    const workspace = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-multi",
      ownerId: "user-multi",
      displayName: "Multi Workspace",
      planId: "enterprise",
      organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-multi",
      organizationId: org.organizationId,
      storageScope: "tenant-multi.storage",
      identityScope: "tenant-multi.identity",
      policyScope: "tenant-multi.policy",
      artifactScope: "tenant-multi.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn",
      plane: "transactional",
      tenantId: tenant.tenantId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "txn_30d",
      encryptionPolicy: "kms:tenant-multi",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-analytics",
      plane: "analytics",
      tenantId: tenant.tenantId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "analytics_180d",
      encryptionPolicy: "kms:tenant-multi",
    });

    // Start multiple pending jobs
    harness.service.startMovementJob({
      jobId: "move-pending",
      sourceNamespaceId: "ns-txn",
      targetNamespaceId: "ns-analytics",
      movementType: "analytics_etl",
      inputRefs: ["task:1"],
    });
    harness.service.startMovementJob({
      jobId: "move-pending-2",
      sourceNamespaceId: "ns-txn",
      targetNamespaceId: "ns-analytics",
      movementType: "analytics_etl",
      inputRefs: ["task:2"],
    });

    const summary = harness.service.buildSummary({
      tenantId: tenant.tenantId,
      generatedAt: "2026-04-08T12:00:00.000Z",
    });

    assert.equal(summary.totals.movementJobs, 2);
    assert.equal(summary.movementJobsByStatus.pending, 2);
    assert.equal(summary.movementJobsByStatus.completed, 0);
    assert.equal(summary.movementJobsByStatus.failed, 0);

    // Complete one job
    harness.service.completeMovementJob({
      jobId: "move-pending",
      report: { movedFacts: 5, verdict: "pass" },
    });

    const summary2 = harness.service.buildSummary({
      tenantId: tenant.tenantId,
      generatedAt: "2026-04-08T12:01:00.000Z",
    });

    assert.equal(summary2.totals.movementJobs, 2);
    assert.equal(summary2.movementJobsByStatus.pending, 1);
    assert.equal(summary2.movementJobsByStatus.completed, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
