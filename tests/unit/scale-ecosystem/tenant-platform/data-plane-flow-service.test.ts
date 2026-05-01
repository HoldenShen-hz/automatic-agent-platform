import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DataPlaneFlowService } from "../../../../src/scale-ecosystem/tenant-platform/data-plane-flow-service.js";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/tenant-platform/tenant-platform-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import type { DataNamespacePlane } from "../../../../src/platform/contracts/types/domain.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "tenant-dpf.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const tenantPlatform = new TenantPlatformService(db, store);
  const service = new DataPlaneFlowService(db, store, {
    artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
  });
  return { workspace, db, store, tenantPlatform, service };
}

test("DataPlaneFlowService rejects invalid fact IDs", () => {
  const harness = createHarness("dpf-invalid-fact-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-if", ownerId: "owner-if", displayName: "Fact Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-if", ownerId: "user-1", displayName: "Fact WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-if", organizationId: org.organizationId,
      storageScope: "tenant-if.storage", identityScope: "tenant-if.identity",
      policyScope: "tenant-if.policy", artifactScope: "tenant-if.artifact",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-analytics", plane: "analytics", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "analytics_180d", encryptionPolicy: "kms:tenant",
    });

    assert.throws(
      () => harness.service.createAnalyticsFact({
        factId: "invalid!", // Invalid character
        namespaceId: "ns-analytics",
        metricName: "test_metric",
        value: 1,
        windowStart: "2026-04-08T00:00:00.000Z",
        windowEnd: "2026-04-08T23:59:59.000Z",
        sourceRef: "task:test",
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.invalid_fact_id",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects invalid metric names", () => {
  const harness = createHarness("dpf-invalid-metric-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-im", ownerId: "owner-im", displayName: "Metric Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-im", ownerId: "user-1", displayName: "Metric WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-im", organizationId: org.organizationId,
      storageScope: "tenant-im.storage", identityScope: "tenant-im.identity",
      policyScope: "tenant-im.policy", artifactScope: "tenant-im.artifact",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-analytics", plane: "analytics", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "analytics_180d", encryptionPolicy: "kms:tenant",
    });

    assert.throws(
      () => harness.service.createAnalyticsFact({
        namespaceId: "ns-analytics",
        metricName: "bad metric!", // Invalid - contains space
        value: 1,
        windowStart: "2026-04-08T00:00:00.000Z",
        windowEnd: "2026-04-08T23:59:59.000Z",
        sourceRef: "task:test",
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.invalid_metric_name",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects invalid timestamps", () => {
  const harness = createHarness("dpf-invalid-ts-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-its", ownerId: "owner-its", displayName: "TS Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-its", ownerId: "user-1", displayName: "TS WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-its", organizationId: org.organizationId,
      storageScope: "tenant-its.storage", identityScope: "tenant-its.identity",
      policyScope: "tenant-its.policy", artifactScope: "tenant-its.artifact",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-analytics", plane: "analytics", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "analytics_180d", encryptionPolicy: "kms:tenant",
    });

    assert.throws(
      () => harness.service.createAnalyticsFact({
        namespaceId: "ns-analytics",
        metricName: "valid_metric",
        value: 1,
        windowStart: "not-a-timestamp",
        windowEnd: "2026-04-08T23:59:59.000Z",
        sourceRef: "task:test",
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.invalid_window_start",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects empty source refs", () => {
  const harness = createHarness("dpf-empty-src-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-es", ownerId: "owner-es", displayName: "SRC Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-es", ownerId: "user-1", displayName: "SRC WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-es", organizationId: org.organizationId,
      storageScope: "tenant-es.storage", identityScope: "tenant-es.identity",
      policyScope: "tenant-es.policy", artifactScope: "tenant-es.artifact",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-analytics", plane: "analytics", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "analytics_180d", encryptionPolicy: "kms:tenant",
    });

    assert.throws(
      () => harness.service.createAnalyticsFact({
        namespaceId: "ns-analytics",
        metricName: "valid_metric",
        value: 1,
        windowStart: "2026-04-08T00:00:00.000Z",
        windowEnd: "2026-04-08T23:59:59.000Z",
        sourceRef: "   ", // Whitespace only
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.invalid_source_ref",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects wrong plane type for namespace", () => {
  const harness = createHarness("dpf-wrong-plane-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-wp", ownerId: "owner-wp", displayName: "Plane Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-wp", ownerId: "user-1", displayName: "Plane WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-wp", organizationId: org.organizationId,
      storageScope: "tenant-wp.storage", identityScope: "tenant-wp.identity",
      policyScope: "tenant-wp.policy", artifactScope: "tenant-wp.artifact",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn", plane: "transactional", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "txn_30d", encryptionPolicy: "kms:tenant",
    });

    // Analytics fact can only go to analytics plane
    assert.throws(
      () => harness.service.createAnalyticsFact({
        namespaceId: "ns-txn", // Wrong plane - transactional not analytics
        metricName: "valid_metric",
        value: 1,
        windowStart: "2026-04-08T00:00:00.000Z",
        windowEnd: "2026-04-08T23:59:59.000Z",
        sourceRef: "task:test",
      }),
      (err: unknown) => (err as { code?: string }).code?.includes("namespace_plane_mismatch"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects cross-tenant movement", () => {
  const harness = createHarness("dpf-cross-tenant-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-ct", ownerId: "owner-ct", displayName: "CrossTenant Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-ct", ownerId: "user-1", displayName: "CrossTenant WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant1 = harness.tenantPlatform.createTenant({
      tenantId: "tenant-ct-1", organizationId: org.organizationId,
      storageScope: "tenant-ct-1.storage", identityScope: "tenant-ct-1.identity",
      policyScope: "tenant-ct-1.policy", artifactScope: "tenant-ct-1.artifact",
    });
    const tenant2 = harness.tenantPlatform.createTenant({
      tenantId: "tenant-ct-2", organizationId: org.organizationId,
      storageScope: "tenant-ct-2.storage", identityScope: "tenant-ct-2.identity",
      policyScope: "tenant-ct-2.policy", artifactScope: "tenant-ct-2.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-src", plane: "transactional", tenantId: "tenant-ct-1",
      workspaceId: ws.workspaceId, retentionPolicy: "txn_30d", encryptionPolicy: "kms:tenant1",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-dst", plane: "analytics", tenantId: "tenant-ct-2",
      workspaceId: ws.workspaceId, retentionPolicy: "analytics_180d", encryptionPolicy: "kms:tenant2",
    });

    assert.throws(
      () => harness.service.startMovementJob({
        sourceNamespaceId: "ns-src",
        targetNamespaceId: "ns-dst",
        movementType: "analytics_etl",
        inputRefs: ["task:1"],
      }),
      (err: unknown) => (err as { code?: string }).code?.includes("cross_tenant"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects disallowed movement types", () => {
  const harness = createHarness("dpf-disallow-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-da", ownerId: "owner-da", displayName: "Disallow Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-da", ownerId: "user-1", displayName: "Disallow WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-da", organizationId: org.organizationId,
      storageScope: "tenant-da.storage", identityScope: "tenant-da.identity",
      policyScope: "tenant-da.policy", artifactScope: "tenant-da.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-analytics", plane: "analytics", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "analytics_180d", encryptionPolicy: "kms:tenant",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn", plane: "transactional", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "txn_30d", encryptionPolicy: "kms:tenant",
    });

    // analytics_etl can only go INTO analytics, not FROM analytics to transactional
    assert.throws(
      () => harness.service.startMovementJob({
        sourceNamespaceId: "ns-analytics",
        targetNamespaceId: "ns-txn",
        movementType: "analytics_etl",
        inputRefs: ["task:1"],
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.movement_not_allowed",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects archive_compaction across planes", () => {
  const harness = createHarness("dpf-archive-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-ar", ownerId: "owner-ar", displayName: "Archive Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-ar", ownerId: "user-1", displayName: "Archive WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-ar", organizationId: org.organizationId,
      storageScope: "tenant-ar.storage", identityScope: "tenant-ar.identity",
      policyScope: "tenant-ar.policy", artifactScope: "tenant-ar.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-archive", plane: "memory_archive", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "archive_365d", encryptionPolicy: "kms:tenant",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn", plane: "transactional", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "txn_30d", encryptionPolicy: "kms:tenant",
    });

    // archive_compaction must stay within memory_archive
    assert.throws(
      () => harness.service.startMovementJob({
        sourceNamespaceId: "ns-archive",
        targetNamespaceId: "ns-txn",
        movementType: "archive_compaction",
        inputRefs: ["task:1"],
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.movement_not_allowed",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects replay_dataset_build from analytics", () => {
  const harness = createHarness("dpf-replay-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-rp", ownerId: "owner-rp", displayName: "Replay Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-rp", ownerId: "user-1", displayName: "Replay WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-rp", organizationId: org.organizationId,
      storageScope: "tenant-rp.storage", identityScope: "tenant-rp.identity",
      policyScope: "tenant-rp.policy", artifactScope: "tenant-rp.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-analytics", plane: "analytics", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "analytics_180d", encryptionPolicy: "kms:tenant",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-replay", plane: "replay", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "replay_90d", encryptionPolicy: "kms:tenant",
    });

    // replay_dataset_build cannot source from analytics plane
    assert.throws(
      () => harness.service.startMovementJob({
        sourceNamespaceId: "ns-analytics",
        targetNamespaceId: "ns-replay",
        movementType: "replay_dataset_build",
        inputRefs: ["task:1"],
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.movement_not_allowed",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects artifact_lifecycle_move across planes", () => {
  const harness = createHarness("dpf-artifact-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-al", ownerId: "owner-al", displayName: "Artifact Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-al", ownerId: "user-1", displayName: "Artifact WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-al", organizationId: org.organizationId,
      storageScope: "tenant-al.storage", identityScope: "tenant-al.identity",
      policyScope: "tenant-al.policy", artifactScope: "tenant-al.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-artifact", plane: "artifact", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "artifact_90d", encryptionPolicy: "kms:tenant",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn", plane: "transactional", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "txn_30d", encryptionPolicy: "kms:tenant",
    });

    // artifact_lifecycle_move must stay within artifact plane
    assert.throws(
      () => harness.service.startMovementJob({
        sourceNamespaceId: "ns-artifact",
        targetNamespaceId: "ns-txn",
        movementType: "artifact_lifecycle_move",
        inputRefs: ["task:1"],
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.movement_not_allowed",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService completeMovementJob throws for unknown job", () => {
  const harness = createHarness("dpf-complete-unknown-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-cu", ownerId: "owner-cu", displayName: "Complete Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-cu", ownerId: "user-1", displayName: "Complete WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-cu", organizationId: org.organizationId,
      storageScope: "tenant-cu.storage", identityScope: "tenant-cu.identity",
      policyScope: "tenant-cu.policy", artifactScope: "tenant-cu.artifact",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn", plane: "transactional", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "txn_30d", encryptionPolicy: "kms:tenant",
    });

    assert.throws(
      () => harness.service.completeMovementJob({ jobId: "nonexistent-job" }),
      (err: unknown) => (err as { code?: string }).code?.includes("movement_job_not_found"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects archive bundle in non-archive plane", () => {
  const harness = createHarness("dpf-bundle-plane-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-bp", ownerId: "owner-bp", displayName: "Bundle Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-bp", ownerId: "user-1", displayName: "Bundle WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-bp", organizationId: org.organizationId,
      storageScope: "tenant-bp.storage", identityScope: "tenant-bp.identity",
      policyScope: "tenant-bp.policy", artifactScope: "tenant-bp.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn", plane: "transactional", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "txn_30d", encryptionPolicy: "kms:tenant",
    });

    // Archive bundles can only go to memory_archive plane
    assert.throws(
      () => harness.service.createArchiveBundle({
        namespaceId: "ns-txn",
        bundleType: "test_bundle",
        sourceRefs: ["artifact:1"],
        summaryRef: "artifact:summary",
      }),
      (err: unknown) => (err as { code?: string }).code?.includes("namespace_plane_mismatch"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects replay dataset in non-replay plane", () => {
  const harness = createHarness("dpf-dataset-plane-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-dp", ownerId: "owner-dp", displayName: "Dataset Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-dp", ownerId: "user-1", displayName: "Dataset WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-dp", organizationId: org.organizationId,
      storageScope: "tenant-dp.storage", identityScope: "tenant-dp.identity",
      policyScope: "tenant-dp.policy", artifactScope: "tenant-dp.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-txn", plane: "transactional", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "txn_30d", encryptionPolicy: "kms:tenant",
    });

    // Replay datasets can only go to replay plane
    assert.throws(
      () => harness.service.createReplayDataset({
        namespaceId: "ns-txn",
        datasetType: "test_dataset",
        sampleRefs: ["sample:1"],
        truthRefs: ["truth:1"],
        version: "v1",
      }),
      (err: unknown) => (err as { code?: string }).code?.includes("namespace_plane_mismatch"),
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("DataPlaneFlowService rejects invalid bundle type identifier", () => {
  const harness = createHarness("dpf-bundle-type-");
  try {
    const org = harness.tenantPlatform.createOrganization({ organizationId: "org-bt", ownerId: "owner-bt", displayName: "BundleType Org" });
    const ws = harness.tenantPlatform.createWorkspace({
      workspaceId: "ws-bt", ownerId: "user-1", displayName: "BundleType WS", planId: "pro", organizationId: org.organizationId,
    });
    const tenant = harness.tenantPlatform.createTenant({
      tenantId: "tenant-bt", organizationId: org.organizationId,
      storageScope: "tenant-bt.storage", identityScope: "tenant-bt.identity",
      policyScope: "tenant-bt.policy", artifactScope: "tenant-bt.artifact",
    });

    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-archive", plane: "memory_archive", tenantId: tenant.tenantId,
      workspaceId: ws.workspaceId, retentionPolicy: "archive_365d", encryptionPolicy: "kms:tenant",
    });

    assert.throws(
      () => harness.service.createArchiveBundle({
        namespaceId: "ns-archive",
        bundleType: "invalid bundle!", // Invalid identifier
        sourceRefs: ["artifact:1"],
        summaryRef: "artifact:summary",
      }),
      (err: unknown) => (err as { code?: string }).code === "data_plane.invalid_bundle_type",
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
