import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DataPlaneFlowService } from "../../../../src/scale-ecosystem/marketplace/data-plane-flow-service.js";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "data-plane-flow-security.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const tenantPlatform = new TenantPlatformService(db, store);
  return { workspace, db, store, tenantPlatform };
}

test("data plane movement jobs fail-close across tenant boundaries", () => {
  const harness = createHarness("aa-data-plane-security-");
  try {
    const orgA = harness.tenantPlatform.createOrganization({
      organizationId: "org-a",
      displayName: "Org A",
    });
    const orgB = harness.tenantPlatform.createOrganization({
      organizationId: "org-b",
      displayName: "Org B",
    });
    const tenantA = harness.tenantPlatform.createTenant({
      tenantId: "tenant-a",
      organizationId: orgA.organizationId,
      storageScope: "tenant-a.storage",
      identityScope: "tenant-a.identity",
      policyScope: "tenant-a.policy",
      artifactScope: "tenant-a.artifact",
    });
    const tenantB = harness.tenantPlatform.createTenant({
      tenantId: "tenant-b",
      organizationId: orgB.organizationId,
      storageScope: "tenant-b.storage",
      identityScope: "tenant-b.identity",
      policyScope: "tenant-b.policy",
      artifactScope: "tenant-b.artifact",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-a",
      plane: "transactional",
      tenantId: tenantA.tenantId,
      retentionPolicy: "txn_30d",
      encryptionPolicy: "kms:tenant-a",
    });
    harness.tenantPlatform.createDataNamespace({
      namespaceId: "ns-b",
      plane: "analytics",
      tenantId: tenantB.tenantId,
      retentionPolicy: "analytics_180d",
      encryptionPolicy: "kms:tenant-b",
    });

    const service = new DataPlaneFlowService(harness.db, harness.store);
    assert.throws(
      () =>
        service.startMovementJob({
          sourceNamespaceId: "ns-a",
          targetNamespaceId: "ns-b",
          movementType: "analytics_etl",
          inputRefs: ["task:cross-tenant"],
        }),
      /data_plane\.cross_tenant_movement_denied/,
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("data plane export fail-closes when artifact root is outside the allowed sandbox workspace", () => {
  const harness = createHarness("aa-data-plane-security-");
  const outsideRoot = createTempWorkspace("aa-data-plane-security-outside-");
  try {
    const service = new DataPlaneFlowService(harness.db, harness.store, {
      artifactStoreOptions: {
        rootDir: join(outsideRoot, "artifacts"),
        sandboxPolicy: createWorkspaceWritePolicy(harness.workspace),
      },
    });

    assert.throws(
      () =>
        service.exportSummary({
          generatedAt: "2026-04-08T12:00:00.000Z",
        }),
      /sandbox\.path_outside_allowed_roots/,
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
    cleanupPath(outsideRoot);
  }
});
