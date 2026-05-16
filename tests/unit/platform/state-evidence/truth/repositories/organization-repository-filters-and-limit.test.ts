import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { OrganizationRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

const now = "2026-04-15T10:00:00.000Z";

test("OrganizationRepository listDataNamespaces with multiple filters", () => {
  const workspace = createTempWorkspace("aa-org-repo-ns-multi-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertTenantRecord({
      tenantId: "tenant-1",
      organizationId: "org-1",
      storageScope: "scoped",
      identityScope: "scoped",
      policyScope: "scoped",
      artifactScope: "scoped",
      isolationMode: "shared_logical",
      deploymentMode: "private_cloud",
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertWorkspaceRecord({
      workspaceId: "ws-1",
      ownerId: "user-1",
      displayName: "Workspace One",
      planId: "plan-pro",
      defaultPolicySet: "default",
      organizationId: "org-1",
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertDataNamespaceRecord({
      namespaceId: "ns-1",
      plane: "analytics",
      tenantId: "tenant-1",
      organizationId: "org-1",
      workspaceId: "ws-1",
      retentionPolicy: "90d",
      encryptionPolicy: "kms",
      residencyPolicy: "us",
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertDataNamespaceRecord({
      namespaceId: "ns-2",
      plane: "replay",
      tenantId: "tenant-1",
      organizationId: "org-1",
      workspaceId: "ws-1",
      retentionPolicy: "30d",
      encryptionPolicy: "none",
      residencyPolicy: "eu",
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listDataNamespaces({ tenantId: "tenant-1", plane: "analytics" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.namespaceId, "ns-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository listWorkspaceRecords respects limit", () => {
  const workspace = createTempWorkspace("aa-org-repo-ws-limit-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 1; i <= 5; i++) {
      repo.upsertWorkspaceRecord({
        workspaceId: `ws-${i}`,
        ownerId: "user-1",
        displayName: `Workspace ${i}`,
        planId: "plan-pro",
        defaultPolicySet: "default",
        organizationId: "org-1",
        createdAt: now,
        updatedAt: now,
      });
    }

    const limited = repo.listWorkspaceRecords({ limit: 3 });
    assert.equal(limited.length, 3);

    const all = repo.listWorkspaceRecords();
    assert.equal(all.length, 5);
  } finally {
    cleanupPath(workspace);
  }
});
