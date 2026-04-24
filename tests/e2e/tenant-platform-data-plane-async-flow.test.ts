import assert from "node:assert/strict";
import test from "node:test";

import { DataPlaneFlowServiceAsync } from "../../src/scale-ecosystem/tenant-platform/data-plane-flow-service-async.js";
import { TenantPlatformServiceAsync } from "../../src/scale-ecosystem/tenant-platform/tenant-platform-service-async.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";

test("E2E: tenant-platform async facade provisions topology and data-plane state end to end", async () => {
  const harness = createE2EHarness("aa-e2e-tenant-platform-async-");

  try {
    const tenantPlatform = new TenantPlatformServiceAsync(harness.db, harness.store);
    const dataPlane = new DataPlaneFlowServiceAsync(harness.db, harness.store);

    const organization = await tenantPlatform.createOrganizationAsync({
      organizationId: "org-async-e2e",
      displayName: "Async E2E Org",
    });
    const workspace = await tenantPlatform.createWorkspaceAsync({
      workspaceId: "workspace-async-e2e",
      ownerId: "user-async-owner",
      displayName: "Async Control Room",
      planId: "plan_pro",
      organizationId: organization.organizationId,
    });
    const tenant = await tenantPlatform.createTenantAsync({
      tenantId: "tenant-async-e2e",
      organizationId: organization.organizationId,
      storageScope: "storage-async",
      identityScope: "identity-async",
      policyScope: "policy-async",
      artifactScope: "artifact-async",
      setAsOrganizationDefault: true,
    });

    const transactionalNamespace = await tenantPlatform.createDataNamespaceAsync({
      namespaceId: "ns-transactional-async",
      plane: "transactional",
      tenantId: tenant.tenantId,
      organizationId: organization.organizationId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "retain_30d",
      encryptionPolicy: "enc_standard",
    });
    const analyticsNamespace = await tenantPlatform.createDataNamespaceAsync({
      namespaceId: "ns-analytics-async",
      plane: "analytics",
      tenantId: tenant.tenantId,
      organizationId: organization.organizationId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "retain_90d",
      encryptionPolicy: "enc_standard",
    });
    const archiveNamespace = await tenantPlatform.createDataNamespaceAsync({
      namespaceId: "ns-archive-async",
      plane: "memory_archive",
      tenantId: tenant.tenantId,
      organizationId: organization.organizationId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "retain_365d",
      encryptionPolicy: "enc_strict",
    });
    const replayNamespace = await tenantPlatform.createDataNamespaceAsync({
      namespaceId: "ns-replay-async",
      plane: "replay",
      tenantId: tenant.tenantId,
      organizationId: organization.organizationId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "retain_30d",
      encryptionPolicy: "enc_standard",
    });

    const topologySummary = tenantPlatform.getSyncService().buildTopologySummary();
    assert.equal(topologySummary.counts.organizations, 1);
    assert.equal(topologySummary.counts.workspaces, 1);
    assert.equal(topologySummary.counts.workspaceMemberships, 1);
    assert.equal(topologySummary.counts.tenants, 1);
    assert.equal(topologySummary.counts.dataNamespaces, 4);
    assert.equal(topologySummary.organizations[0]?.defaultTenantId, tenant.tenantId);

    await dataPlane.createAnalyticsFactAsync({
      factId: "fact-async-1",
      namespaceId: analyticsNamespace.namespaceId,
      metricName: "latency_p95",
      value: 182,
      windowStart: "2026-04-24T00:00:00.000Z",
      windowEnd: "2026-04-24T00:05:00.000Z",
      sourceRef: "artifact://batch/latency",
    });
    await dataPlane.createArchiveBundleAsync({
      bundleId: "bundle-async-1",
      namespaceId: archiveNamespace.namespaceId,
      bundleType: "memory_snapshot",
      sourceRefs: ["artifact://snapshots/1"],
      summaryRef: "artifact://snapshots/1/summary",
    });
    await dataPlane.createReplayDatasetAsync({
      datasetId: "dataset-async-1",
      namespaceId: replayNamespace.namespaceId,
      datasetType: "incident_replay",
      sampleRefs: ["artifact://replay/sample-1"],
      truthRefs: ["artifact://replay/truth-1"],
      version: "v1",
    });

    const movement = dataPlane.getSyncService().startMovementJob({
      jobId: "move-async-1",
      sourceNamespaceId: transactionalNamespace.namespaceId,
      targetNamespaceId: analyticsNamespace.namespaceId,
      movementType: "analytics_etl",
      inputRefs: ["artifact://batch/latency"],
    });
    dataPlane.getSyncService().completeMovementJob({
      jobId: movement.jobId,
      status: "completed",
      report: {
        movedFacts: 1,
      },
    });

    const summary = await dataPlane.buildSummaryAsync({
      tenantId: tenant.tenantId,
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
    assert.equal(summary.recentJobs[0]?.jobId, "move-async-1");
  } finally {
    harness.cleanup();
  }
});
