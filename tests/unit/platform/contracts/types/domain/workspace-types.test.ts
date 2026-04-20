import assert from "node:assert/strict";
import test from "node:test";

import type {
  WorkspaceRecord,
  WorkspaceMembershipRecord,
  OrganizationRecord,
  OrganizationMembershipRecord,
  TenantRecord,
  DeploymentBindingRecord,
  DataNamespaceRecord,
} from "../../../../../../src/platform/contracts/types/domain/workspace-types.js";
import type {
  TenantIsolationMode,
  DeploymentMode,
  DataNamespacePlane,
} from "../../../../../../src/platform/contracts/types/domain/primitives.js";

test("WorkspaceRecord structure is correct", () => {
  const record: WorkspaceRecord = {
    workspaceId: "ws_123",
    ownerId: "user_456",
    displayName: "My Workspace",
    planId: "plan_pro",
    defaultPolicySet: "default",
    organizationId: "org_789",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.workspaceId, "ws_123");
  assert.equal(record.displayName, "My Workspace");
  assert.equal(record.planId, "plan_pro");
});

test("WorkspaceRecord allows null organizationId", () => {
  const record: WorkspaceRecord = {
    workspaceId: "ws_personal",
    ownerId: "user_personal",
    displayName: "Personal Workspace",
    planId: "plan_basic",
    defaultPolicySet: "default",
    organizationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.organizationId, null);
});

test("WorkspaceMembershipRecord structure is correct", () => {
  const record: WorkspaceMembershipRecord = {
    workspaceId: "ws_123",
    userId: "user_456",
    role: "admin",
    joinedAt: "2026-04-01T00:00:00.000Z",
  };
  assert.equal(record.workspaceId, "ws_123");
  assert.equal(record.role, "admin");
});

test("WorkspaceMembershipRecord allows member role", () => {
  const record: WorkspaceMembershipRecord = {
    workspaceId: "ws_member",
    userId: "user_member",
    role: "member",
    joinedAt: "2026-04-10T00:00:00.000Z",
  };
  assert.equal(record.role, "member");
});

test("OrganizationRecord structure is correct", () => {
  const record: OrganizationRecord = {
    organizationId: "org_123",
    displayName: "Acme Corp",
    billingAccountId: "acct_456",
    defaultTenantId: "tenant_789",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.organizationId, "org_123");
  assert.equal(record.displayName, "Acme Corp");
  assert.equal(record.billingAccountId, "acct_456");
});

test("OrganizationRecord allows null billingAccountId", () => {
  const record: OrganizationRecord = {
    organizationId: "org_new",
    displayName: "New Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.billingAccountId, null);
  assert.equal(record.defaultTenantId, null);
});

test("OrganizationMembershipRecord structure is correct", () => {
  const record: OrganizationMembershipRecord = {
    organizationId: "org_123",
    userId: "user_456",
    role: "owner",
    joinedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(record.organizationId, "org_123");
  assert.equal(record.role, "owner");
});

test("OrganizationMembershipRecord allows viewer role", () => {
  const record: OrganizationMembershipRecord = {
    organizationId: "org_viewer",
    userId: "user_viewer",
    role: "viewer",
    joinedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.role, "viewer");
});

test("TenantRecord structure is correct", () => {
  const record: TenantRecord = {
    tenantId: "tenant_123",
    organizationId: "org_456",
    storageScope: "storage_us",
    identityScope: "identity_global",
    policyScope: "policy_standard",
    artifactScope: "artifact_primary",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "cloud_shared",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.tenantId, "tenant_123");
  assert.equal(record.isolationMode, "shared_hard_scoped");
  assert.equal(record.deploymentMode, "cloud_shared");
});

test("TenantRecord allows dedicated_runtime isolation", () => {
  const record: TenantRecord = {
    tenantId: "tenant_dedicated",
    organizationId: "org_dedicated",
    storageScope: "storage_dedicated",
    identityScope: "identity_dedicated",
    policyScope: "policy_dedicated",
    artifactScope: "artifact_dedicated",
    isolationMode: "dedicated_runtime",
    deploymentMode: "private_cloud",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.isolationMode, "dedicated_runtime");
  assert.equal(record.deploymentMode, "private_cloud");
});

test("TenantIsolationMode accepts all valid values", () => {
  const modes: TenantIsolationMode[] = [
    "shared_logical",
    "shared_hard_scoped",
    "dedicated_runtime",
    "dedicated_environment",
  ];
  assert.equal(modes.length, 4);
});

test("DeploymentMode accepts all valid values", () => {
  const modes: DeploymentMode[] = ["cloud_shared", "private_cloud", "on_prem"];
  assert.equal(modes.length, 3);
});

test("DeploymentBindingRecord structure is correct", () => {
  const record: DeploymentBindingRecord = {
    bindingId: "binding_123",
    tenantId: "tenant_456",
    environmentId: "env_789",
    deploymentMode: "cloud_shared",
    region: "us-east-1",
    networkBoundary: "public",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.bindingId, "binding_123");
  assert.equal(record.region, "us-east-1");
  assert.equal(record.networkBoundary, "public");
});

test("DeploymentBindingRecord allows private network", () => {
  const record: DeploymentBindingRecord = {
    bindingId: "binding_private",
    tenantId: "tenant_private",
    environmentId: "env_private",
    deploymentMode: "private_cloud",
    region: "us-west-2",
    networkBoundary: "private",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.networkBoundary, "private");
});

test("DataNamespaceRecord structure is correct", () => {
  const record: DataNamespaceRecord = {
    namespaceId: "ns_123",
    plane: "transactional",
    tenantId: "tenant_456",
    organizationId: "org_789",
    workspaceId: "ws_abc",
    retentionPolicy: "standard",
    encryptionPolicy: "aes256",
    residencyPolicy: "us-region",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.namespaceId, "ns_123");
  assert.equal(record.plane, "transactional");
  assert.equal(record.residencyPolicy, "us-region");
});

test("DataNamespaceRecord allows null optional fields", () => {
  const record: DataNamespaceRecord = {
    namespaceId: "ns_minimal",
    plane: "memory_archive",
    tenantId: null,
    organizationId: null,
    workspaceId: null,
    retentionPolicy: "standard",
    encryptionPolicy: "aes256",
    residencyPolicy: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.tenantId, null);
  assert.equal(record.residencyPolicy, null);
});

test("DataNamespacePlane accepts all valid values", () => {
  const planes: DataNamespacePlane[] = [
    "transactional",
    "artifact",
    "analytics",
    "memory_archive",
    "replay",
  ];
  assert.equal(planes.length, 5);
});
