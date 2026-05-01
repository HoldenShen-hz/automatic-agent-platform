/**
 * Tenant Platform Service Integration Tests
 *
 * Tests end-to-end tenant topology workflows including:
 * - Organization -> Workspace -> Tenant hierarchy creation
 * - Deployment binding lifecycle
 * - Data namespace scoping and boundaries
 * - Topology summary generation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TenantPlatformService } from "../../../src/scale-ecosystem/tenant-platform/tenant-platform-service.js";
import type {
  AuthoritativeSqlDatabase,
  AuthoritativeTaskStore,
} from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Store and Database Setup
// ─────────────────────────────────────────────────────────────────────────────

interface MockStore {
  workspaces: Map<string, any>;
  workspaceMemberships: any[];
  organizations: Map<string, any>;
  organizationMemberships: any[];
  tenants: Map<string, any>;
  deploymentBindings: Map<string, any>;
  dataNamespaces: Map<string, any>;
  billingAccounts: Map<string, any>;
}

function createMockStore(): MockStore {
  return {
    workspaces: new Map(),
    workspaceMemberships: [],
    organizations: new Map(),
    organizationMemberships: [],
    tenants: new Map(),
    deploymentBindings: new Map(),
    dataNamespaces: new Map(),
    billingAccounts: new Map(),
  };
}

function createMockTaskStore(mock: MockStore): AuthoritativeTaskStore {
  return {
    organization: {
      getWorkspaceRecord: (id: string) => mock.workspaces.get(id) || null,
      upsertWorkspaceRecord: (record: any) => mock.workspaces.set(record.workspaceId, record),
      listWorkspaceRecords: ({ limit }: { limit?: number } = {}) =>
        Array.from(mock.workspaces.values()).slice(0, limit),
      getOrganizationRecord: (id: string) => mock.organizations.get(id) || null,
      upsertOrganizationRecord: (record: any) => mock.organizations.set(record.organizationId, record),
      listOrganizationRecords: (limit?: number) =>
        Array.from(mock.organizations.values()).slice(0, limit),
      getTenantRecord: (id: string) => mock.tenants.get(id) || null,
      upsertTenantRecord: (record: any) => mock.tenants.set(record.tenantId, record),
      listTenantRecords: ({ limit }: { limit?: number } = {}) =>
        Array.from(mock.tenants.values()).slice(0, limit),
      upsertDeploymentBindingRecord: (record: any) => mock.deploymentBindings.set(record.bindingId, record),
      listDeploymentBindings: ({ limit }: { limit?: number } = {}) =>
        Array.from(mock.deploymentBindings.values()).slice(0, limit),
      upsertDataNamespaceRecord: (record: any) => mock.dataNamespaces.set(record.namespaceId, record),
      listDataNamespaces: ({ limit }: { limit?: number } = {}) =>
        Array.from(mock.dataNamespaces.values()).slice(0, limit),
      listWorkspaceMemberships: (workspaceId: string) =>
        mock.workspaceMemberships.filter((m) => m.workspaceId === workspaceId),
      upsertWorkspaceMembershipRecord: (record: any) => mock.workspaceMemberships.push(record),
      listOrganizationMemberships: (orgId: string) =>
        mock.organizationMemberships.filter((m) => m.organizationId === orgId),
      upsertOrganizationMembershipRecord: (record: any) => mock.organizationMemberships.push(record),
    },
    billing: {
      getBillingAccount: (id: string) => mock.billingAccounts.get(id) || null,
      upsertBillingAccount: (record: any) => mock.billingAccounts.set(record.accountId, record),
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T): T => fn(),
    filePath: "/tmp/test.db",
  } as unknown as AuthoritativeSqlDatabase;
}

// ─────────────────────────────────────────────────────────────────────────────
// Organization Lifecycle Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: create organization with billing account", () => {
  const mock = createMockStore();
  mock.billingAccounts.set("bill_acct_001", {
    accountId: "bill_acct_001",
    ownerId: "owner_001",
    workspaceId: null,
    planId: "enterprise",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const org = service.createOrganization({
    ownerId: "owner_enterprise_001",
    displayName: "Enterprise Corp",
    billingAccountId: "bill_acct_001",
  });

  assert.equal(org.displayName, "Enterprise Corp");
  assert.equal(org.billingAccountId, "bill_acct_001");
  assert.ok(org.organizationId.startsWith("org:"));
});

test("integration: create organization without billing account", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const org = service.createOrganization({
    ownerId: "owner_startup_001",
    displayName: "Startup Inc",
  });

  assert.equal(org.displayName, "Startup Inc");
  assert.equal(org.billingAccountId, null);
});

test("integration: add organization membership", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);
  const organization = service.createOrganization({
    organizationId: "org_001",
    ownerId: "owner_org_001",
    displayName: "Test Org",
  });

  const membership = service.addOrganizationMembership({
    organizationId: organization.organizationId,
    callerUserId: "owner_org_001",
    userId: "user_001",
    role: "admin",
  });

  assert.equal(membership.organizationId, "org_001");
  assert.equal(membership.userId, "user_001");
  assert.equal(membership.role, "admin");
  assert.ok(membership.joinedAt);
});

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Lifecycle Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: create workspace within organization", () => {
  const mock = createMockStore();
  mock.organizations.set("org_001", {
    organizationId: "org_001",
    displayName: "Parent Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const workspace = service.createWorkspace({
    ownerId: "owner_001",
    displayName: "Engineering Workspace",
    planId: "plan_pro",
    organizationId: "org_001",
  });

  assert.equal(workspace.organizationId, "org_001");
  assert.equal(workspace.displayName, "Engineering Workspace");
  assert.equal(workspace.planId, "plan_pro");
});

test("integration: create workspace adds owner as member", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const workspace = service.createWorkspace({
    ownerId: "owner_001",
    displayName: "Owner Test Workspace",
    planId: "plan_basic",
  });

  // Check that owner was added as member
  const memberships = mock.workspaceMemberships.filter(
    (m) => m.workspaceId === workspace.workspaceId
  );

  assert.equal(memberships.length, 1);
  assert.equal(memberships[0].role, "owner");
  assert.equal(memberships[0].userId, "owner_001");
});

test("integration: add workspace membership", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);
  const workspace = service.createWorkspace({
    workspaceId: "ws_001",
    ownerId: "owner_x",
    displayName: "Test WS",
    planId: "plan_basic",
  });

  const membership = service.addWorkspaceMembership({
    workspaceId: workspace.workspaceId,
    callerUserId: "owner_x",
    userId: "developer_001",
    role: "developer",
  });

  assert.equal(membership.workspaceId, "ws_001");
  assert.equal(membership.userId, "developer_001");
  assert.equal(membership.role, "developer");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant Lifecycle Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: create tenant with dedicated_pool isolation", () => {
  const mock = createMockStore();
  mock.organizations.set("org_dedicated", {
    organizationId: "org_dedicated",
    displayName: "Dedicated Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const tenant = service.createTenant({
    organizationId: "org_dedicated",
    storageScope: "storage_scope",
    identityScope: "identity_scope",
    policyScope: "policy_scope",
    artifactScope: "artifact_scope",
    isolationMode: "dedicated_pool",
  });

  assert.equal(tenant.organizationId, "org_dedicated");
  assert.equal(tenant.isolationMode, "dedicated_pool");
  assert.equal(tenant.deploymentMode, "private_cloud"); // Auto-upgraded from shared
  assert.ok(tenant.storageScope.includes("-dedicated"));
  assert.ok(tenant.identityScope.includes("-dedicated"));
  assert.ok(tenant.artifactScope.includes("-dedicated"));

  // Verify dedicated data namespace was created
  const namespaces = Array.from(mock.dataNamespaces.values());
  assert.equal(namespaces.length, 1);
  assert.equal(namespaces[0].plane, "transactional");
  assert.equal(namespaces[0].tenantId, tenant.tenantId);
});

test("integration: create tenant sets organization default", () => {
  const mock = createMockStore();
  mock.organizations.set("org_default", {
    organizationId: "org_default",
    displayName: "Default Test Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const tenant = service.createTenant({
    organizationId: "org_default",
    storageScope: "storage",
    identityScope: "identity",
    policyScope: "policy",
    artifactScope: "artifact",
    setAsOrganizationDefault: true,
  });

  const updatedOrg = mock.organizations.get("org_default");
  assert.equal(updatedOrg.defaultTenantId, tenant.tenantId);
});

test("integration: create multiple tenants within organization", () => {
  const mock = createMockStore();
  mock.organizations.set("org_multi", {
    organizationId: "org_multi",
    displayName: "Multi Tenant Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const tenant1 = service.createTenant({
    organizationId: "org_multi",
    storageScope: "storage_1",
    identityScope: "identity_1",
    policyScope: "policy_1",
    artifactScope: "artifact_1",
  });

  const tenant2 = service.createTenant({
    organizationId: "org_multi",
    storageScope: "storage_2",
    identityScope: "identity_2",
    policyScope: "policy_2",
    artifactScope: "artifact_2",
  });

  assert.notEqual(tenant1.tenantId, tenant2.tenantId);
  assert.equal(tenant1.organizationId, tenant2.organizationId);
  assert.equal(mock.tenants.size, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Deployment Binding Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: create deployment binding for tenant", () => {
  const mock = createMockStore();
  mock.organizations.set("org_binding", {
    organizationId: "org_binding",
    displayName: "Binding Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  mock.tenants.set("tenant_binding", {
    tenantId: "tenant_binding",
    organizationId: "org_binding",
    displayName: "Binding Tenant",
    storageScope: "storage",
    identityScope: "identity",
    policyScope: "policy",
    artifactScope: "artifact",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "cloud_shared",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const binding = service.createDeploymentBinding({
    tenantId: "tenant_binding",
    environmentId: "env_production",
    deploymentMode: "cloud_shared",
    region: "us-east-1",
    networkBoundary: "boundary_public",
  });

  assert.equal(binding.tenantId, "tenant_binding");
  assert.equal(binding.environmentId, "env_production");
  assert.equal(binding.region, "us-east-1");
  assert.equal(binding.networkBoundary, "boundary_public");
  assert.ok(binding.bindingId.startsWith("binding:"));
});

test("integration: create multiple deployment bindings for same tenant", () => {
  const mock = createMockStore();
  mock.organizations.set("org_multi_binding", {
    organizationId: "org_multi_binding",
    displayName: "Multi Binding Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  mock.tenants.set("tenant_multi_binding", {
    tenantId: "tenant_multi_binding",
    organizationId: "org_multi_binding",
    displayName: "Multi Binding Tenant",
    storageScope: "storage",
    identityScope: "identity",
    policyScope: "policy",
    artifactScope: "artifact",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "cloud_shared",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const binding1 = service.createDeploymentBinding({
    tenantId: "tenant_multi_binding",
    environmentId: "env_production",
    deploymentMode: "cloud_shared",
    region: "us-east-1",
    networkBoundary: "boundary_public",
  });

  const binding2 = service.createDeploymentBinding({
    tenantId: "tenant_multi_binding",
    environmentId: "env_production",
    deploymentMode: "cloud_dedicated",
    region: "us-west-2",
    networkBoundary: "boundary_private",
  });

  assert.notEqual(binding1.bindingId, binding2.bindingId);
  assert.equal(binding1.region, "us-east-1");
  assert.equal(binding2.region, "us-west-2");
  assert.equal(mock.deploymentBindings.size, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Data Namespace Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: create data namespace with tenant scope", () => {
  const mock = createMockStore();
  mock.organizations.set("org_ns", {
    organizationId: "org_ns",
    displayName: "NS Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  mock.tenants.set("tenant_ns", {
    tenantId: "tenant_ns",
    organizationId: "org_ns",
    displayName: "NS Tenant",
    storageScope: "storage",
    identityScope: "identity",
    policyScope: "policy",
    artifactScope: "artifact",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "cloud_shared",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const ns = service.createDataNamespace({
    plane: "transactional",
    tenantId: "tenant_ns",
    retentionPolicy: "retention_30d",
    encryptionPolicy: "enc_aes256",
  });

  assert.equal(ns.plane, "transactional");
  assert.equal(ns.tenantId, "tenant_ns");
  assert.equal(ns.organizationId, "org_ns");
  assert.equal(ns.workspaceId, null);
  assert.equal(ns.retentionPolicy, "retention_30d");
  assert.equal(ns.encryptionPolicy, "enc_aes256");
});

test("integration: create data namespace with workspace scope", () => {
  const mock = createMockStore();
  mock.organizations.set("org_ws", {
    organizationId: "org_ws",
    displayName: "WS Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  mock.workspaces.set("ws_001", {
    workspaceId: "ws_001",
    ownerId: "owner_ws",
    displayName: "WS 001",
    planId: "plan_basic",
    organizationId: "org_ws",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const ns = service.createDataNamespace({
    plane: "analytics",
    workspaceId: "ws_001",
    retentionPolicy: "retention_90d",
    encryptionPolicy: "enc_standard",
  });

  assert.equal(ns.plane, "analytics");
  assert.equal(ns.workspaceId, "ws_001");
  assert.equal(ns.organizationId, "org_ws");
  assert.equal(ns.tenantId, null);
});

test("integration: create data namespace throws on cross-tenant scope violation", () => {
  const mock = createMockStore();
  mock.organizations.set("org_wrong", {
    organizationId: "org_wrong",
    displayName: "Wrong Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  mock.organizations.set("org_right", {
    organizationId: "org_right",
    displayName: "Right Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  mock.tenants.set("tenant_wrong", {
    tenantId: "tenant_wrong",
    organizationId: "org_wrong",
    displayName: "Wrong Tenant",
    storageScope: "storage",
    identityScope: "identity",
    policyScope: "policy",
    artifactScope: "artifact",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "cloud_shared",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  mock.workspaces.set("ws_right", {
    workspaceId: "ws_right",
    ownerId: "owner_right",
    displayName: "Right WS",
    planId: "plan_basic",
    organizationId: "org_right",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createDataNamespace({
      plane: "transactional",
      workspaceId: "ws_right", // Belongs to org_right
      tenantId: "tenant_wrong", // Belongs to org_wrong
      retentionPolicy: "retention_30d",
      encryptionPolicy: "enc_standard",
    });
  }, /tenant.workspace_tenant_organization_mismatch/);
});

test("integration: create data namespace throws when no scope provided", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createDataNamespace({
      plane: "transactional",
      retentionPolicy: "retention_30d",
      encryptionPolicy: "enc_standard",
    });
  }, /tenant.namespace_scope_required/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Topology Summary Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: buildTopologySummary returns complete topology", () => {
  const mock = createMockStore();

  // Set up organizations
  mock.organizations.set("org_summary", {
    organizationId: "org_summary",
    displayName: "Summary Org",
    billingAccountId: null,
    defaultTenantId: "tenant_summary",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // Set up workspaces
  mock.workspaces.set("ws_summary", {
    workspaceId: "ws_summary",
    ownerId: "owner_summary",
    displayName: "Summary WS",
    planId: "plan_pro",
    organizationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // Set up tenants
  mock.tenants.set("tenant_summary", {
    tenantId: "tenant_summary",
    organizationId: "org_summary",
    displayName: "Summary Tenant",
    storageScope: "storage",
    identityScope: "identity",
    policyScope: "policy",
    artifactScope: "artifact",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "cloud_shared",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // Set up deployment bindings
  mock.deploymentBindings.set("binding_summary", {
    bindingId: "binding_summary",
    tenantId: "tenant_summary",
    environmentId: "env_prod",
    deploymentMode: "cloud_shared",
    region: "us-east-1",
    networkBoundary: "boundary_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // Set up data namespaces
  mock.dataNamespaces.set("ns_summary", {
    namespaceId: "ns_summary",
    plane: "transactional",
    tenantId: "tenant_summary",
    organizationId: "org_summary",
    workspaceId: null,
    retentionPolicy: "retention_30d",
    encryptionPolicy: "enc_standard",
    residencyPolicy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // Set up memberships
  mock.workspaceMemberships.push({
    workspaceId: "ws_summary",
    userId: "owner_summary",
    role: "owner",
    joinedAt: "2026-01-01T00:00:00.000Z",
  });
  mock.organizationMemberships.push({
    organizationId: "org_summary",
    userId: "admin_user",
    role: "admin",
    joinedAt: "2026-01-01T00:00:00.000Z",
  });

  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const summary = service.buildTopologySummary();

  assert.ok(summary.generatedAt);
  assert.equal(summary.counts.workspaces, 1);
  assert.equal(summary.counts.organizations, 1);
  assert.equal(summary.counts.tenants, 1);
  assert.equal(summary.counts.deploymentBindings, 1);
  assert.equal(summary.counts.dataNamespaces, 1);
  assert.equal(summary.counts.workspaceMemberships, 1);
  assert.equal(summary.counts.organizationMemberships, 1);
});

test("integration: buildTopologySummary with empty topology", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const summary = service.buildTopologySummary();

  assert.equal(summary.counts.workspaces, 0);
  assert.equal(summary.counts.organizations, 0);
  assert.equal(summary.counts.tenants, 0);
  assert.equal(summary.counts.deploymentBindings, 0);
  assert.equal(summary.counts.dataNamespaces, 0);
  assert.equal(summary.workspaces.length, 0);
  assert.equal(summary.organizations.length, 0);
  assert.equal(summary.tenants.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: reject invalid workspace identifier", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createWorkspace({
      workspaceId: "invalid id!",  // Contains space and special chars
      ownerId: "owner_001",
      displayName: "Test",
      planId: "plan_basic",
    });
  }, /tenant.invalid_workspace_id/);
});

test("integration: reject invalid owner identifier", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createWorkspace({
      workspaceId: "ws_001",
      ownerId: "",  // Empty
      displayName: "Test",
      planId: "plan_basic",
    });
  }, /tenant.invalid_owner_id/);
});

test("integration: reject empty display name", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createWorkspace({
      workspaceId: "ws_001",
      ownerId: "owner_001",
      displayName: "   ",  // Whitespace only
      planId: "plan_basic",
    });
  }, /tenant.invalid_workspace_display_name/);
});

test("integration: reject non-existent organization", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createTenant({
      organizationId: "nonexistent_org",
      storageScope: "storage",
      identityScope: "identity",
      policyScope: "policy",
      artifactScope: "artifact",
    });
  }, /tenant.organization_not_found/);
});

test("integration: reject non-existent billing account", () => {
  const mock = createMockStore();
  const store = createMockTaskStore(mock);
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createOrganization({
      ownerId: "owner_bad_billing",
      displayName: "Bad Billing Org",
      billingAccountId: "nonexistent_billing",
    });
  }, /tenant.billing_account_not_found/);
});
