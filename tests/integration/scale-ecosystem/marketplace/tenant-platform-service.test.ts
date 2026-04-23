import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { createIntegrationContext } from "../../helpers/integration-context.js";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service.js";

test("tenant platform service creates workspace with owner membership", () => {
  const ctx = createIntegrationContext("aa-tenant-workspace-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    const workspace = service.createWorkspace({
      ownerId: "user_001",
      displayName: "Engineering Workspace",
      planId: "enterprise",
      organizationId: null,
    });

    assert.equal(workspace.displayName, "Engineering Workspace");
    assert.equal(workspace.ownerId, "user_001");
    assert.equal(workspace.planId, "enterprise");

    const memberships = ctx.store.organization.listWorkspaceMemberships(workspace.workspaceId);
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].userId, "user_001");
    assert.equal(memberships[0].role, "owner");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service creates organization with billing account binding", () => {
  const ctx = createIntegrationContext("aa-tenant-org-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    // First create a billing account
    ctx.store.billing.upsertBillingAccount({
      accountId: "billing_acct_001",
      ownerId: "org_owner_001",
      workspaceId: null,
      planId: "pro",
      status: "active",
      createdAt: "2026-04-20T10:00:00.000Z",
      updatedAt: "2026-04-20T10:00:00.000Z",
    });

    const organization = service.createOrganization({
      displayName: "Acme Corporation",
      billingAccountId: "billing_acct_001",
    });

    assert.equal(organization.displayName, "Acme Corporation");
    assert.equal(organization.billingAccountId, "billing_acct_001");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service creates tenant within organization", () => {
  const ctx = createIntegrationContext("aa-tenant-create-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    // Create organization first
    const org = service.createOrganization({
      displayName: "Test Organization",
    });

    const tenant = service.createTenant({
      organizationId: org.organizationId,
      storageScope: "storage_scope_001",
      identityScope: "identity_scope_001",
      policyScope: "policy_scope_001",
      artifactScope: "artifact_scope_001",
    });

    assert.equal(tenant.organizationId, org.organizationId);
    assert.equal(tenant.storageScope, "storage_scope_001");
    assert.equal(tenant.isolationMode, "shared_hard_scoped");
    assert.equal(tenant.deploymentMode, "cloud_shared");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service creates deployment binding for tenant", () => {
  const ctx = createIntegrationContext("aa-tenant-binding-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    const org = service.createOrganization({ displayName: "Binding Test Org" });
    const tenant = service.createTenant({
      organizationId: org.organizationId,
      storageScope: "storage_test",
      identityScope: "identity_test",
      policyScope: "policy_test",
      artifactScope: "artifact_test",
    });

    const binding = service.createDeploymentBinding({
      tenantId: tenant.tenantId,
      environmentId: "production",
      deploymentMode: "cloud_dedicated",
      region: "us-east-1",
      networkBoundary: "boundary_001",
    });

    assert.equal(binding.tenantId, tenant.tenantId);
    assert.equal(binding.environmentId, "production");
    assert.equal(binding.region, "us-east-1");
    assert.equal(binding.deploymentMode, "cloud_dedicated");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service creates data namespace with tenant scope", () => {
  const ctx = createIntegrationContext("aa-tenant-namespace-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    const org = service.createOrganization({ displayName: "Namespace Test Org" });
    const tenant = service.createTenant({
      organizationId: org.organizationId,
      storageScope: "storage_ns",
      identityScope: "identity_ns",
      policyScope: "policy_ns",
      artifactScope: "artifact_ns",
    });

    const namespace = service.createDataNamespace({
      plane: "transactional",
      tenantId: tenant.tenantId,
      retentionPolicy: "retention_90d",
      encryptionPolicy: "encryption_standard",
      residencyPolicy: "us_only",
    });

    assert.equal(namespace.plane, "transactional");
    assert.equal(namespace.tenantId, tenant.tenantId);
    assert.equal(namespace.retentionPolicy, "retention_90d");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service creates data namespace with organization scope", () => {
  const ctx = createIntegrationContext("aa-tenant-ns-org-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    const org = service.createOrganization({ displayName: "Org Scope Namespace" });

    const namespace = service.createDataNamespace({
      plane: "analytics",
      organizationId: org.organizationId,
      retentionPolicy: "retention_180d",
      encryptionPolicy: "encryption_standard",
    });

    assert.equal(namespace.plane, "analytics");
    assert.equal(namespace.organizationId, org.organizationId);
    assert.equal(namespace.tenantId, null);

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service builds topology summary", () => {
  const ctx = createIntegrationContext("aa-tenant-topology-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    // Create a small topology
    const org = service.createOrganization({ displayName: "Topology Test Org" });
    const workspace = service.createWorkspace({
      ownerId: "user_topology",
      displayName: "Topology Workspace",
      planId: "pro",
      organizationId: org.organizationId,
    });
    const tenant = service.createTenant({
      organizationId: org.organizationId,
      storageScope: "storage_topology",
      identityScope: "identity_topology",
      policyScope: "policy_topology",
      artifactScope: "artifact_topology",
    });

    const summary = service.buildTopologySummary();

    assert.equal(summary.counts.organizations, 1);
    assert.equal(summary.counts.workspaces, 1);
    assert.equal(summary.counts.tenants, 1);
    assert.ok(summary.generatedAt);
    assert.equal(summary.organizations.length, 1);
    assert.equal(summary.workspaces.length, 1);
    assert.equal(summary.tenants.length, 1);

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service sets new tenant as organization default", () => {
  const ctx = createIntegrationContext("aa-tenant-default-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    const org = service.createOrganization({ displayName: "Default Tenant Test" });

    // First tenant should become default
    const tenant1 = service.createTenant({
      organizationId: org.organizationId,
      storageScope: "storage_1",
      identityScope: "identity_1",
      policyScope: "policy_1",
      artifactScope: "artifact_1",
    });

    const updatedOrg = ctx.store.organization.getOrganizationRecord(org.organizationId);
    assert.equal(updatedOrg?.defaultTenantId, tenant1.tenantId);

    // Second tenant should not change default
    const tenant2 = service.createTenant({
      organizationId: org.organizationId,
      storageScope: "storage_2",
      identityScope: "identity_2",
      policyScope: "policy_2",
      artifactScope: "artifact_2",
    });

    const stillTenant1 = ctx.store.organization.getOrganizationRecord(org.organizationId);
    assert.equal(stillTenant1?.defaultTenantId, tenant1.tenantId);

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service validates workspace scope consistency", () => {
  const ctx = createIntegrationContext("aa-tenant-validation-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    const org = service.createOrganization({ displayName: "Validation Test Org" });
    const tenant = service.createTenant({
      organizationId: org.organizationId,
      storageScope: "storage_val",
      identityScope: "identity_val",
      policyScope: "policy_val",
      artifactScope: "artifact_val",
    });

    const workspace = service.createWorkspace({
      ownerId: "user_val",
      displayName: "Validation Workspace",
      planId: "pro",
      organizationId: org.organizationId,
    });

    // Creating namespace with both tenant and workspace from same org should work
    const namespace = service.createDataNamespace({
      plane: "memory_archive",
      tenantId: tenant.tenantId,
      workspaceId: workspace.workspaceId,
      retentionPolicy: "retention_30d",
      encryptionPolicy: "encryption_standard",
    });

    assert.ok(namespace.workspaceId);
    assert.equal(namespace.tenantId, tenant.tenantId);

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("tenant platform service adds workspace membership", () => {
  const ctx = createIntegrationContext("aa-tenant-membership-");
  try {
    const service = new TenantPlatformService(ctx.db, ctx.store);

    const workspace = service.createWorkspace({
      ownerId: "owner_001",
      displayName: "Membership Test Workspace",
      planId: "pro",
    });

    const membership = service.addWorkspaceMembership({
      workspaceId: workspace.workspaceId,
      userId: "member_001",
      role: "developer",
    });

    assert.equal(membership.workspaceId, workspace.workspaceId);
    assert.equal(membership.userId, "member_001");
    assert.equal(membership.role, "developer");

    const allMemberships = ctx.store.organization.listWorkspaceMemberships(workspace.workspaceId);
    assert.equal(allMemberships.length, 2); // owner + new member

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});