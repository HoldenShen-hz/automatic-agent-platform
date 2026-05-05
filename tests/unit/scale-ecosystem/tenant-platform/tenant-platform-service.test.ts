// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/tenant-platform/tenant-platform-service.js";

function createMockStore() {
  const workspaces = new Map();
  const workspaceMemberships = [];
  const organizations = new Map();
  const organizationMemberships = [];
  const tenants = new Map();
  const deploymentBindings = new Map();
  const dataNamespaces = new Map();
  const billingAccounts = new Map();

  return {
    organization: {
      getWorkspaceRecord: (id) => workspaces.get(id) || null,
      upsertWorkspaceRecord: (record) => workspaces.set(record.workspaceId, record),
      listWorkspaceRecords: ({ limit } = {}) => Array.from(workspaces.values()).slice(0, limit),
      getOrganizationRecord: (id) => organizations.get(id) || null,
      upsertOrganizationRecord: (record) => organizations.set(record.organizationId, record),
      listOrganizationRecords: (limit) => Array.from(organizations.values()).slice(0, limit),
      getTenantRecord: (id) => tenants.get(id) || null,
      upsertTenantRecord: (record) => tenants.set(record.tenantId, record),
      listTenantRecords: ({ limit } = {}) => Array.from(tenants.values()).slice(0, limit),
      upsertDeploymentBindingRecord: (record) => deploymentBindings.set(record.bindingId, record),
      listDeploymentBindings: ({ limit } = {}) => Array.from(deploymentBindings.values()).slice(0, limit),
      upsertDataNamespaceRecord: (record) => dataNamespaces.set(record.namespaceId, record),
      listDataNamespaces: ({ limit } = {}) => Array.from(dataNamespaces.values()).slice(0, limit),
      listWorkspaceMemberships: (workspaceId) => workspaceMemberships.filter(m => m.workspaceId === workspaceId),
      upsertWorkspaceMembershipRecord: (record) => workspaceMemberships.push(record),
      listOrganizationMemberships: (orgId) => organizationMemberships.filter(m => m.organizationId === orgId),
      upsertOrganizationMembershipRecord: (record) => organizationMemberships.push(record),
    },
    billing: {
      getBillingAccount: (id) => billingAccounts.get(id) || null,
      upsertBillingAccount: (record) => billingAccounts.set(record.accountId, record),
    },
  };
}

function createMockDb() {
  return {
    transaction: (fn) => fn(),
    filePath: "/tmp/test.db",
  };
}

test("TenantPlatformService.createWorkspace creates workspace and adds owner membership", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const workspace = service.createWorkspace({
    ownerId: "owner_001",
    displayName: "Test Workspace",
    planId: "plan_basic",
  });

  assert.equal(workspace.ownerId, "owner_001");
  assert.equal(workspace.displayName, "Test Workspace");
  assert.equal(workspace.planId, "plan_basic");
  assert.ok(workspace.workspaceId);
  assert.ok(workspace.createdAt);
});

test("TenantPlatformService.createWorkspace accepts custom workspaceId", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const workspace = service.createWorkspace({
    workspaceId: "ws_custom_123",
    ownerId: "owner_002",
    displayName: "Custom Workspace",
    planId: "plan_pro",
  });

  assert.equal(workspace.workspaceId, "ws_custom_123");
});

test("TenantPlatformService.createWorkspace with organizationId links to organization", () => {
  const store = createMockStore();
  store.organization.upsertOrganizationRecord({
    organizationId: "org_001",
    displayName: "Test Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const workspace = service.createWorkspace({
    ownerId: "owner_003",
    displayName: "Child Workspace",
    planId: "plan_basic",
    organizationId: "org_001",
  });

  assert.equal(workspace.organizationId, "org_001");
});

test("TenantPlatformService.assertNoCrossTenantDataMovement allows same-tenant and null-target access", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.doesNotThrow(() => service.assertNoCrossTenantDataMovement("tenant_same", "tenant_same"));
  assert.doesNotThrow(() => service.assertNoCrossTenantDataMovement("tenant_same", null));
});

test("TenantPlatformService.assertNoCrossTenantDataMovement blocks cross-tenant movement", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(
    () => service.assertNoCrossTenantDataMovement("tenant_a", "tenant_b"),
    /tenant\.cross_tenant_data_movement/,
  );
});

test("TenantPlatformService.addWorkspaceMembership adds member to workspace", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);
  const workspace = service.createWorkspace({
    workspaceId: "ws_001",
    ownerId: "owner_x",
    displayName: "WS X",
    planId: "plan_basic",
  });

  const membership = service.addWorkspaceMembership({
    workspaceId: workspace.workspaceId,
    callerUserId: "owner_x",
    userId: "user_001",
    role: "member",
  });

  assert.equal(membership.workspaceId, "ws_001");
  assert.equal(membership.userId, "user_001");
  assert.equal(membership.role, "member");
});

test("TenantPlatformService.addWorkspaceMembership rejects callers without owner or admin membership", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);
  const workspace = service.createWorkspace({
    workspaceId: "ws_unauthorized",
    ownerId: "owner_x",
    displayName: "WS X",
    planId: "plan_basic",
  });

  assert.throws(() => {
    service.addWorkspaceMembership({
      workspaceId: workspace.workspaceId,
      callerUserId: "intruder_y",
      userId: "user_001",
      role: "member",
    });
  }, /Caller must be workspace owner or admin to add members/);
});

test("TenantPlatformService.createOrganization creates organization", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const org = service.createOrganization({
    ownerId: "owner_org_001",
    displayName: "My Organization",
  });

  assert.equal(org.displayName, "My Organization");
  assert.ok(org.organizationId);
  assert.ok(org.createdAt);
  const memberships = store.organization.listOrganizationMemberships(org.organizationId);
  assert.equal(memberships.length, 1);
  assert.equal(memberships[0]?.userId, "owner_org_001");
  assert.equal(memberships[0]?.role, "owner");
});

test("TenantPlatformService.createOrganization with billing account validates account exists", () => {
  const store = createMockStore();
  store.billing.upsertBillingAccount({
    accountId: "bill_acct_001",
    ownerId: "owner_billing",
    workspaceId: null,
    planId: "enterprise",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const org = service.createOrganization({
    ownerId: "owner_billing",
    displayName: "Org With Billing",
    billingAccountId: "bill_acct_001",
  });

  assert.equal(org.billingAccountId, "bill_acct_001");
});

test("TenantPlatformService.createOrganization throws for non-existent billing account", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createOrganization({
      ownerId: "owner_missing_billing",
      displayName: "Bad Org",
      billingAccountId: "nonexistent_billing",
    });
  }, /tenant.billing_account_not_found/);
});

test("TenantPlatformService.addOrganizationMembership adds member to organization", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);
  const organization = service.createOrganization({
    organizationId: "org_002",
    ownerId: "owner_org_002",
    displayName: "Org Two",
  });

  const membership = service.addOrganizationMembership({
    organizationId: organization.organizationId,
    callerUserId: "owner_org_002",
    userId: "user_002",
    role: "admin",
  });

  assert.equal(membership.organizationId, "org_002");
  assert.equal(membership.userId, "user_002");
  assert.equal(membership.role, "admin");
});

test("TenantPlatformService.addOrganizationMembership rejects callers without owner or admin membership", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);
  const organization = service.createOrganization({
    organizationId: "org_unauthorized",
    ownerId: "owner_org_unauthorized",
    displayName: "Org Unauthorized",
  });

  assert.throws(() => {
    service.addOrganizationMembership({
      organizationId: organization.organizationId,
      callerUserId: "intruder_y",
      userId: "user_002",
      role: "admin",
    });
  }, /Caller must be organization owner or admin to add members/);
});

test("TenantPlatformService.createTenant creates tenant within organization", () => {
  const store = createMockStore();
  store.organization.upsertOrganizationRecord({
    organizationId: "org_003",
    displayName: "Org Three",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const tenant = service.createTenant({
    organizationId: "org_003",
    storageScope: "storage_scope_1",
    identityScope: "identity_scope_1",
    policyScope: "policy_scope_1",
    artifactScope: "artifact_scope_1",
  });

  assert.equal(tenant.organizationId, "org_003");
  assert.equal(tenant.storageScope, "storage_scope_1");
  assert.equal(tenant.isolationMode, "shared_hard_scoped");
  assert.equal(tenant.deploymentMode, "cloud_shared");
});

test("TenantPlatformService.createTenant sets organization default when requested", () => {
  const store = createMockStore();
  store.organization.upsertOrganizationRecord({
    organizationId: "org_default_test",
    displayName: "Default Test Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const tenant = service.createTenant({
    organizationId: "org_default_test",
    storageScope: "storage_default",
    identityScope: "identity_default",
    policyScope: "policy_default",
    artifactScope: "artifact_default",
    setAsOrganizationDefault: true,
  });

  const updatedOrg = store.organization.getOrganizationRecord("org_default_test");
  assert.equal(updatedOrg.defaultTenantId, tenant.tenantId);
});

test("TenantPlatformService.createDeploymentBinding creates binding for tenant", () => {
  const store = createMockStore();
  store.organization.upsertOrganizationRecord({
    organizationId: "org_binding",
    displayName: "Binding Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  store.organization.upsertTenantRecord({
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
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const binding = service.createDeploymentBinding({
    tenantId: "tenant_binding",
    environmentId: "env_production",
    deploymentMode: "cloud_shared",
    region: "us-east-1",
    networkBoundary: "boundary_1",
  });

  assert.equal(binding.tenantId, "tenant_binding");
  assert.equal(binding.environmentId, "env_production");
  assert.equal(binding.region, "us-east-1");
});

test("TenantPlatformService.createDataNamespace creates namespace with tenant scope", () => {
  const store = createMockStore();
  store.organization.upsertOrganizationRecord({
    organizationId: "org_ns",
    displayName: "NS Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  store.organization.upsertTenantRecord({
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
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const ns = service.createDataNamespace({
    plane: "transactional",
    tenantId: "tenant_ns",
    retentionPolicy: "retention_30d",
    encryptionPolicy: "enc_standard",
  });

  assert.equal(ns.plane, "transactional");
  assert.equal(ns.tenantId, "tenant_ns");
  assert.equal(ns.retentionPolicy, "retention_30d");
});

test("TenantPlatformService.createDataNamespace throws when no scope provided", () => {
  const store = createMockStore();
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

test("TenantPlatformService.createDataNamespace throws on workspace-tenant organization mismatch", () => {
  const store = createMockStore();
  store.organization.upsertOrganizationRecord({
    organizationId: "org_wrong",
    displayName: "Wrong Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  store.organization.upsertOrganizationRecord({
    organizationId: "org_other",
    displayName: "Other Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  store.organization.upsertWorkspaceRecord({
    workspaceId: "ws_conflict",
    ownerId: "owner_ws",
    displayName: "Conflict WS",
    planId: "plan_basic",
    organizationId: "org_wrong",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  store.organization.upsertTenantRecord({
    tenantId: "tenant_conflict",
    organizationId: "org_other",
    displayName: "Conflict Tenant",
    storageScope: "storage",
    identityScope: "identity",
    policyScope: "policy",
    artifactScope: "artifact",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "cloud_shared",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createDataNamespace({
      plane: "transactional",
      workspaceId: "ws_conflict",
      tenantId: "tenant_conflict",
      retentionPolicy: "retention_30d",
      encryptionPolicy: "enc_standard",
    });
  }, /tenant.workspace_tenant_organization_mismatch/);
});

test("TenantPlatformService.buildTopologySummary returns complete summary", () => {
  const store = createMockStore();
  store.organization.upsertOrganizationRecord({
    organizationId: "org_summary",
    displayName: "Summary Org",
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  store.organization.upsertWorkspaceRecord({
    workspaceId: "ws_summary",
    ownerId: "owner_summary",
    displayName: "Summary WS",
    planId: "plan_basic",
    organizationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  store.organization.upsertTenantRecord({
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
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  const summary = service.buildTopologySummary();

  assert.equal(summary.counts.workspaces, 1);
  assert.equal(summary.counts.organizations, 1);
  assert.equal(summary.counts.tenants, 1);
  assert.ok(summary.generatedAt);
});

test("TenantPlatformService throws for invalid workspaceId format", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createWorkspace({
      workspaceId: "bad id",
      ownerId: "owner_bad",
      displayName: "Bad WS",
      planId: "plan_basic",
    });
  }, /tenant.invalid_workspace_id/);
});

test("TenantPlatformService throws for invalid ownerId format", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createWorkspace({
      ownerId: "!invalid",
      displayName: "Bad Owner",
      planId: "plan_basic",
    });
  }, /tenant.invalid_owner_id/);
});

test("TenantPlatformService throws for empty displayName", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new TenantPlatformService(db, store);

  assert.throws(() => {
    service.createWorkspace({
      ownerId: "owner_empty",
      displayName: "   ",
      planId: "plan_basic",
    });
  }, /tenant.invalid_workspace_display_name/);
});
