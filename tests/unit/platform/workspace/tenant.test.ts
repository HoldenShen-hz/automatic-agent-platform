/**
 * Unit Tests: Tenant
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  TenantBoundaryRegistryService,
  type UserAccount,
  type TenantBoundaryTopologySeed,
  type TenantAccessDecision,
} from "../../../../src/platform/five-plane-control-plane/tenant/index.js";

// ============================================================================
// Tenant Boundary Registry Service Tests
// ============================================================================

test("TenantBoundaryRegistryService registers user", () => {
  const service = new TenantBoundaryRegistryService();

  const user = service.registerUser({
    userId: "user_001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp_123",
  });

  assert.equal(user.userId, "user_001");
  assert.equal(user.displayName, "Test User");
  assert.equal(user.status, "active");
  assert.ok(user.createdAt.length > 0);
});

test("TenantBoundaryRegistryService registers workspace", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_001",
    name: "Test Org",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const workspace = service.registerWorkspace({
    workspaceId: "ws_001",
    organizationId: "org_001",
    name: "Test Workspace",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(workspace.workspaceId, "ws_001");
  assert.equal(workspace.organizationId, "org_001");
});

test("TenantBoundaryRegistryService registers organization", () => {
  const service = new TenantBoundaryRegistryService();

  const org = service.registerOrganization({
    organizationId: "org_002",
    name: "Another Org",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(org.organizationId, "org_002");
  assert.equal(org.name, "Another Org");
});

test("TenantBoundaryRegistryService registers tenant", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_003",
    name: "Org for Tenant",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const tenant = service.registerTenant({
    tenantId: "tenant_001",
    organizationId: "org_003",
    name: "Test Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(tenant.tenantId, "tenant_001");
  assert.equal(tenant.organizationId, "org_003");
});

test("TenantBoundaryRegistryService adds workspace membership", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user_ws_001",
    displayName: "Workspace User",
    status: "active",
    identityProvider: "idp",
  });

  service.registerOrganization({
    organizationId: "org_ws_001",
    name: "Org",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerWorkspace({
    workspaceId: "ws_member_001",
    organizationId: "org_ws_001",
    name: "Workspace",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const membership = service.addWorkspaceMembership({
    workspaceId: "ws_member_001",
    userId: "user_ws_001",
    role: "member",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(membership.workspaceId, "ws_member_001");
  assert.equal(membership.userId, "user_ws_001");
  assert.equal(membership.role, "member");
});

test("TenantBoundaryRegistryService adds organization membership", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user_org_001",
    displayName: "Org Member",
    status: "active",
    identityProvider: "idp",
  });

  service.registerOrganization({
    organizationId: "org_member_001",
    name: "Org with Member",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const membership = service.addOrganizationMembership({
    organizationId: "org_member_001",
    userId: "user_org_001",
    role: "admin",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(membership.organizationId, "org_member_001");
  assert.equal(membership.userId, "user_org_001");
});

test("TenantBoundaryRegistryService resolves tenant for workspace", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_resolve_001",
    name: "Org",
    defaultTenantId: "tenant_resolve_001",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_resolve_001",
    organizationId: "org_resolve_001",
    name: "Resolved Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerWorkspace({
    workspaceId: "ws_resolve_001",
    organizationId: "org_resolve_001",
    name: "Workspace",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const tenant = service.resolveTenantForWorkspace("ws_resolve_001");

  assert.ok(tenant !== null);
  assert.equal(tenant?.tenantId, "tenant_resolve_001");
});

test("TenantBoundaryRegistryService authorizes tenant access for member", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user_auth_001",
    displayName: "Auth User",
    status: "active",
    identityProvider: "idp",
  });

  service.registerOrganization({
    organizationId: "org_auth_001",
    name: "Org",
    defaultTenantId: "tenant_auth_001",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_auth_001",
    organizationId: "org_auth_001",
    name: "Auth Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.addOrganizationMembership({
    organizationId: "org_auth_001",
    userId: "user_auth_001",
    role: "member",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const decision = service.authorizeTenantAccess({
    userId: "user_auth_001",
    tenantId: "tenant_auth_001",
  });

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "tenant.member_allowed");
});

test("TenantBoundaryRegistryService denies access for disabled user", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user_disabled_001",
    displayName: "Disabled User",
    status: "disabled",
    identityProvider: "idp",
  });

  service.registerOrganization({
    organizationId: "org_disabled_001",
    name: "Org",
    defaultTenantId: "tenant_disabled_001",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_disabled_001",
    organizationId: "org_disabled_001",
    name: "Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const decision = service.authorizeTenantAccess({
    userId: "user_disabled_001",
    tenantId: "tenant_disabled_001",
  });

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "tenant.user_disabled");
});

test("TenantBoundaryRegistryService denies cross-tenant workspace access", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user_cross_001",
    displayName: "Cross Tenant User",
    status: "active",
    identityProvider: "idp",
  });

  service.registerOrganization({
    organizationId: "org_cross_001",
    name: "Org A",
    defaultTenantId: "tenant_cross_a",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerOrganization({
    organizationId: "org_cross_002",
    name: "Org B",
    defaultTenantId: "tenant_cross_b",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_cross_a",
    organizationId: "org_cross_001",
    name: "Tenant A",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_cross_b",
    organizationId: "org_cross_002",
    name: "Tenant B",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerWorkspace({
    workspaceId: "ws_cross_b",
    organizationId: "org_cross_002",
    name: "Workspace B",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const decision = service.authorizeTenantAccess({
    userId: "user_cross_001",
    tenantId: "tenant_cross_a",
    workspaceId: "ws_cross_b",
  });

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "tenant.workspace_tenant_mismatch");
});

test("TenantBoundaryRegistryService allows governance exception", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user_gov_001",
    displayName: "Governance User",
    status: "active",
    identityProvider: "idp",
  });

  service.registerOrganization({
    organizationId: "org_gov_001",
    name: "Org",
    defaultTenantId: "tenant_gov_001",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_gov_001",
    organizationId: "org_gov_001",
    name: "Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const decision = service.authorizeTenantAccess({
    userId: "user_gov_001",
    tenantId: "tenant_gov_001",
    governanceRef: "emergency_access_policy",
  });

  assert.equal(decision.decision, "allow_with_governance_exception");
  assert.equal(decision.reasonCode, "tenant.governance_exception");
});

test("TenantBoundaryRegistryService asserts same tenant", () => {
  const service = new TenantBoundaryRegistryService();

  assert.doesNotThrow(() =>
    service.assertSameTenant({
      sourceTenantId: "tenant_001",
      targetTenantId: "tenant_001",
    }),
  );
});

test("TenantBoundaryRegistryService throws for different tenants", () => {
  const service = new TenantBoundaryRegistryService();

  assert.throws(
    () =>
      service.assertSameTenant({
        sourceTenantId: "tenant_001",
        targetTenantId: "tenant_002",
      }),
    /cross_tenant_denied/,
  );
});

test("TenantBoundaryRegistryService lists deployment bindings", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_binding_001",
    name: "Org",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_binding_001",
    organizationId: "org_binding_001",
    name: "Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerDeploymentBinding({
    bindingId: "binding_001",
    tenantId: "tenant_binding_001",
    deploymentId: "deploy_001",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const bindings = service.listDeploymentBindingsForTenant("tenant_binding_001");

  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].bindingId, "binding_001");
});

test("TenantBoundaryRegistryService lists tenants for user", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user_tenant_list",
    displayName: "Tenant List User",
    status: "active",
    identityProvider: "idp",
  });

  service.registerOrganization({
    organizationId: "org_list_001",
    name: "Org 1",
    defaultTenantId: "tenant_list_001",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_list_001",
    organizationId: "org_list_001",
    name: "Tenant 1",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.addOrganizationMembership({
    organizationId: "org_list_001",
    userId: "user_tenant_list",
    role: "member",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const tenants = service.listTenantsForUser("user_tenant_list");

  assert.equal(tenants.length, 1);
  assert.equal(tenants[0].tenantId, "tenant_list_001");
});

test("TenantBoundaryRegistryService lists tenants with limit", () => {
  const service = new TenantBoundaryRegistryService();

  for (let i = 0; i < 5; i++) {
    service.registerOrganization({
      organizationId: `org_limit_${i}`,
      name: `Org ${i}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    });

    service.registerTenant({
      tenantId: `tenant_limit_${i}`,
      organizationId: `org_limit_${i}`,
      name: `Tenant ${i}`,
      status: "active",
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    });
  }

  const tenants = service.listTenants(3);

  assert.equal(tenants.length, 3);
});

test("TenantBoundaryRegistryService rejects invalid user ID", () => {
  const service = new TenantBoundaryRegistryService();

  assert.throws(
    () =>
      service.registerUser({
        userId: "invalid user id!",
        displayName: "Test",
        status: "active",
        identityProvider: "idp",
      }),
    /invalid_user_id/,
  );
});

test("TenantBoundaryRegistryService rejects invalid workspace ID", () => {
  const service = new TenantBoundaryRegistryService();

  assert.throws(
    () =>
      service.registerWorkspace({
        workspaceId: "bad@workspace",
        organizationId: "org_001",
        name: "Workspace",
        createdAt: "2026-04-29T00:00:00.000Z",
      }),
    /invalid_workspace_id/,
  );
});
