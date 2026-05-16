import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { OrganizationRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

const now = "2026-04-15T10:00:00.000Z";

test("OrganizationRepository upsertWorkspaceRecord and getWorkspaceRecord", () => {
  const workspace = createTempWorkspace("aa-org-repo-ws-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organization first
    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
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

    const result = repo.getWorkspaceRecord("ws-1");
    assert.ok(result);
    assert.equal(result.workspaceId, "ws-1");
    assert.equal(result.ownerId, "user-1");
    assert.equal(result.displayName, "Workspace One");
    assert.equal(result.planId, "plan-pro");
    assert.equal(result.defaultPolicySet, "default");
    assert.equal(result.organizationId, "org-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository upsertWorkspaceRecord updates existing record", () => {
  const workspace = createTempWorkspace("aa-org-repo-ws-upd-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organizations first
    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertOrganizationRecord({
      organizationId: "org-2",
      displayName: "Org Two",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertWorkspaceRecord({
      workspaceId: "ws-1",
      ownerId: "user-1",
      displayName: "Original Name",
      planId: "plan-basic",
      defaultPolicySet: "default",
      organizationId: "org-1",
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertWorkspaceRecord({
      workspaceId: "ws-1",
      ownerId: "user-2",
      displayName: "Updated Name",
      planId: "plan-pro",
      defaultPolicySet: "custom",
      organizationId: "org-2",
      createdAt: now,
      updatedAt: now,
    });

    const result = repo.getWorkspaceRecord("ws-1");
    assert.ok(result);
    assert.equal(result.displayName, "Updated Name");
    assert.equal(result.ownerId, "user-2");
    assert.equal(result.organizationId, "org-2");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository getWorkspaceRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-org-repo-ws-null-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    const result = repo.getWorkspaceRecord("nonexistent");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository listWorkspaceRecords returns all workspaces", () => {
  const workspace = createTempWorkspace("aa-org-repo-ws-list-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organizations first
    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertOrganizationRecord({
      organizationId: "org-2",
      displayName: "Org Two",
      billingAccountId: null,
      defaultTenantId: null,
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
    repo.upsertWorkspaceRecord({
      workspaceId: "ws-2",
      ownerId: "user-2",
      displayName: "Workspace Two",
      planId: "plan-basic",
      defaultPolicySet: "default",
      organizationId: "org-2",
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listWorkspaceRecords();
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository listWorkspaceRecords filters by organizationId", () => {
  const workspace = createTempWorkspace("aa-org-repo-ws-filter-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organizations first
    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertOrganizationRecord({
      organizationId: "org-2",
      displayName: "Org Two",
      billingAccountId: null,
      defaultTenantId: null,
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
    repo.upsertWorkspaceRecord({
      workspaceId: "ws-2",
      ownerId: "user-2",
      displayName: "Workspace Two",
      planId: "plan-basic",
      defaultPolicySet: "default",
      organizationId: "org-2",
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listWorkspaceRecords({ organizationId: "org-1" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.workspaceId, "ws-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository upsertWorkspaceMembershipRecord and listWorkspaceMemberships", () => {
  const workspace = createTempWorkspace("aa-org-repo-ws-mem-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organization and workspace first
    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
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

    repo.upsertWorkspaceMembershipRecord({
      workspaceId: "ws-1",
      userId: "user-1",
      role: "admin",
      joinedAt: now,
    });
    repo.upsertWorkspaceMembershipRecord({
      workspaceId: "ws-1",
      userId: "user-2",
      role: "viewer",
      joinedAt: now,
    });

    const memberships = repo.listWorkspaceMemberships("ws-1");
    assert.equal(memberships.length, 2);
    assert.ok(memberships.some(m => m.userId === "user-1" && m.role === "admin"));
    assert.ok(memberships.some(m => m.userId === "user-2" && m.role === "viewer"));
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository upsertOrganizationRecord and getOrganizationRecord", () => {
  const workspace = createTempWorkspace("aa-org-repo-org-");
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

    const result = repo.getOrganizationRecord("org-1");
    assert.ok(result);
    assert.equal(result.organizationId, "org-1");
    assert.equal(result.displayName, "Org One");
    assert.equal(result.billingAccountId, null);
    assert.equal(result.defaultTenantId, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository getOrganizationRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-org-repo-org-null-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    const result = repo.getOrganizationRecord("nonexistent");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository listOrganizationRecords returns all organizations", () => {
  const workspace = createTempWorkspace("aa-org-repo-org-list-");
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
    repo.upsertOrganizationRecord({
      organizationId: "org-2",
      displayName: "Org Two",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listOrganizationRecords();
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository upsertOrganizationMembershipRecord and listOrganizationMemberships", () => {
  const workspace = createTempWorkspace("aa-org-repo-org-mem-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organization first
    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertOrganizationMembershipRecord({
      organizationId: "org-1",
      userId: "user-1",
      role: "owner",
      joinedAt: now,
    });
    repo.upsertOrganizationMembershipRecord({
      organizationId: "org-1",
      userId: "user-2",
      role: "member",
      joinedAt: now,
    });

    const memberships = repo.listOrganizationMemberships("org-1");
    assert.equal(memberships.length, 2);
    assert.ok(memberships.some(m => m.userId === "user-1" && m.role === "owner"));
    assert.ok(memberships.some(m => m.userId === "user-2" && m.role === "member"));
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository upsertTenantRecord and getTenantRecord", () => {
  const workspace = createTempWorkspace("aa-org-repo-tenant-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organization first
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

    const result = repo.getTenantRecord("tenant-1");
    assert.ok(result);
    assert.equal(result.tenantId, "tenant-1");
    assert.equal(result.organizationId, "org-1");
    assert.equal(result.storageScope, "scoped");
    assert.equal(result.isolationMode, "shared_logical");
    assert.equal(result.deploymentMode, "private_cloud");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository getTenantRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-org-repo-tenant-null-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    const result = repo.getTenantRecord("nonexistent");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository listTenantRecords filters by organizationId", () => {
  const workspace = createTempWorkspace("aa-org-repo-tenant-list-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organizations first
    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertOrganizationRecord({
      organizationId: "org-2",
      displayName: "Org Two",
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
    repo.upsertTenantRecord({
      tenantId: "tenant-2",
      organizationId: "org-2",
      storageScope: "global",
      identityScope: "global",
      policyScope: "global",
      artifactScope: "global",
      isolationMode: "dedicated_runtime",
      deploymentMode: "cloud_shared",
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listTenantRecords({ organizationId: "org-1" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.tenantId, "tenant-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository upsertDeploymentBindingRecord and getDeploymentBindingRecord", () => {
  const workspace = createTempWorkspace("aa-org-repo-binding-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organization and tenant first
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

    repo.upsertDeploymentBindingRecord({
      bindingId: "binding-1",
      tenantId: "tenant-1",
      environmentId: "production",
      deploymentMode: "private_cloud",
      region: "us-east-1",
      networkBoundary: "private",
      createdAt: now,
      updatedAt: now,
    });

    const result = repo.getDeploymentBindingRecord("binding-1");
    assert.ok(result);
    assert.equal(result.bindingId, "binding-1");
    assert.equal(result.tenantId, "tenant-1");
    assert.equal(result.environmentId, "production");
    assert.equal(result.region, "us-east-1");
    assert.equal(result.networkBoundary, "private");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository getDeploymentBindingRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-org-repo-binding-null-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    const result = repo.getDeploymentBindingRecord("nonexistent");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository listDeploymentBindings filters by tenantId", () => {
  const workspace = createTempWorkspace("aa-org-repo-binding-list-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent organizations and tenants first
    repo.upsertOrganizationRecord({
      organizationId: "org-1",
      displayName: "Org One",
      billingAccountId: null,
      defaultTenantId: null,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertOrganizationRecord({
      organizationId: "org-2",
      displayName: "Org Two",
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
    repo.upsertTenantRecord({
      tenantId: "tenant-2",
      organizationId: "org-2",
      storageScope: "global",
      identityScope: "global",
      policyScope: "global",
      artifactScope: "global",
      isolationMode: "dedicated_runtime",
      deploymentMode: "cloud_shared",
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertDeploymentBindingRecord({
      bindingId: "binding-1",
      tenantId: "tenant-1",
      environmentId: "production",
      deploymentMode: "private_cloud",
      region: "us-east-1",
      networkBoundary: "private",
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertDeploymentBindingRecord({
      bindingId: "binding-2",
      tenantId: "tenant-2",
      environmentId: "staging",
      deploymentMode: "cloud_shared",
      region: "eu-west-1",
      networkBoundary: "public",
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listDeploymentBindings({ tenantId: "tenant-1" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.bindingId, "binding-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository upsertDataNamespaceRecord and getDataNamespaceRecord", () => {
  const workspace = createTempWorkspace("aa-org-repo-ns-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent records first
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

    const result = repo.getDataNamespaceRecord("ns-1");
    assert.ok(result);
    assert.equal(result.namespaceId, "ns-1");
    assert.equal(result.plane, "analytics");
    assert.equal(result.tenantId, "tenant-1");
    assert.equal(result.organizationId, "org-1");
    assert.equal(result.workspaceId, "ws-1");
    assert.equal(result.retentionPolicy, "90d");
    assert.equal(result.encryptionPolicy, "kms");
    assert.equal(result.residencyPolicy, "us");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository getDataNamespaceRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-org-repo-ns-null-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    const result = repo.getDataNamespaceRecord("nonexistent");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository listDataNamespaces filters by plane", () => {
  const workspace = createTempWorkspace("aa-org-repo-ns-list-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent records first
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

    const analyticsNs = repo.listDataNamespaces({ plane: "analytics" });
    assert.equal(analyticsNs.length, 1);
    assert.equal(analyticsNs[0]?.namespaceId, "ns-1");

    const replayNs = repo.listDataNamespaces({ plane: "replay" });
    assert.equal(replayNs.length, 1);
    assert.equal(replayNs[0]?.namespaceId, "ns-2");
  } finally {
    cleanupPath(workspace);
  }
});

test("OrganizationRepository listDataNamespaces filters by tenantId", () => {
  const workspace = createTempWorkspace("aa-org-repo-ns-tenant-");
  const dbPath = join(workspace, "org-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OrganizationRepository(db);

    // Insert parent records first
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
    repo.upsertTenantRecord({
      tenantId: "tenant-2",
      organizationId: "org-1",
      storageScope: "global",
      identityScope: "global",
      policyScope: "global",
      artifactScope: "global",
      isolationMode: "dedicated_runtime",
      deploymentMode: "cloud_shared",
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
      plane: "analytics",
      tenantId: "tenant-2",
      organizationId: "org-1",
      workspaceId: "ws-1",
      retentionPolicy: "60d",
      encryptionPolicy: "kms",
      residencyPolicy: "eu",
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listDataNamespaces({ tenantId: "tenant-1" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.namespaceId, "ns-1");
  } finally {
    cleanupPath(workspace);
  }
});
