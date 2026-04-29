/**
 * Integration Tests: Tenant
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  TenantBoundaryRegistryService,
} from "../../../../../src/platform/five-plane-control-plane/tenant/index.js";

// ============================================================================
// Tenant End-to-End Integration Tests
// ============================================================================

test("integration: full tenant isolation workflow", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_iso_001",
    name: "Isolated Org",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_iso_001",
    organizationId: "org_iso_001",
    name: "Isolated Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerUser({
    userId: "user_iso_001",
    displayName: "Isolated User",
    status: "active",
    identityProvider: "idp_iso",
  });

  service.addOrganizationMembership({
    organizationId: "org_iso_001",
    userId: "user_iso_001",
    role: "member",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const accessDecision = service.authorizeTenantAccess({
    userId: "user_iso_001",
    tenantId: "tenant_iso_001",
  });

  assert.equal(accessDecision.decision, "allow");
  assert.equal(accessDecision.reasonCode, "tenant.member_allowed");
});

test("integration: cross-tenant isolation enforced", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_a",
    name: "Org A",
    defaultTenantId: "tenant_a",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerOrganization({
    organizationId: "org_b",
    name: "Org B",
    defaultTenantId: "tenant_b",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_a",
    organizationId: "org_a",
    name: "Tenant A",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_b",
    organizationId: "org_b",
    name: "Tenant B",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerUser({
    userId: "user_cross",
    displayName: "Cross Tenant User",
    status: "active",
    identityProvider: "idp",
  });

  service.addOrganizationMembership({
    organizationId: "org_a",
    userId: "user_cross",
    role: "member",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerWorkspace({
    workspaceId: "ws_b",
    organizationId: "org_b",
    name: "Workspace B",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const decision = service.authorizeTenantAccess({
    userId: "user_cross",
    tenantId: "tenant_a",
    workspaceId: "ws_b",
  });

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "tenant.workspace_tenant_mismatch");
});

test("integration: governance exception grants temporary access", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_gov",
    name: "Governance Org",
    defaultTenantId: "tenant_gov",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_gov",
    organizationId: "org_gov",
    name: "Governance Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerUser({
    userId: "user_gov",
    displayName: "Governance User",
    status: "active",
    identityProvider: "idp",
  });

  const noMembershipDecision = service.authorizeTenantAccess({
    userId: "user_gov",
    tenantId: "tenant_gov",
  });

  assert.equal(noMembershipDecision.decision, "deny");

  const withException = service.authorizeTenantAccess({
    userId: "user_gov",
    tenantId: "tenant_gov",
    governanceRef: "emergency_access_policy",
  });

  assert.equal(withException.decision, "allow_with_governance_exception");
});

test("integration: disabled user denied access", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_disabled",
    name: "Disabled Org",
    defaultTenantId: "tenant_disabled",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_disabled",
    organizationId: "org_disabled",
    name: "Disabled Tenant",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerUser({
    userId: "user_disabled",
    displayName: "Disabled User",
    status: "disabled",
    identityProvider: "idp",
  });

  service.addOrganizationMembership({
    organizationId: "org_disabled",
    userId: "user_disabled",
    role: "admin",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const decision = service.authorizeTenantAccess({
    userId: "user_disabled",
    tenantId: "tenant_disabled",
  });

  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "tenant.user_disabled");
});

test("integration: deployment bindings per tenant", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_deploy",
    name: "Deploy Org",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_deploy_001",
    organizationId: "org_deploy",
    name: "Deploy Tenant 1",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_deploy_002",
    organizationId: "org_deploy",
    name: "Deploy Tenant 2",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerDeploymentBinding({
    bindingId: "binding_1",
    tenantId: "tenant_deploy_001",
    deploymentId: "deploy_001",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerDeploymentBinding({
    bindingId: "binding_2",
    tenantId: "tenant_deploy_001",
    deploymentId: "deploy_002",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerDeploymentBinding({
    bindingId: "binding_3",
    tenantId: "tenant_deploy_002",
    deploymentId: "deploy_003",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const tenant1Bindings = service.listDeploymentBindingsForTenant("tenant_deploy_001");
  const tenant2Bindings = service.listDeploymentBindingsForTenant("tenant_deploy_002");

  assert.equal(tenant1Bindings.length, 2);
  assert.equal(tenant2Bindings.length, 1);
});

test("integration: user sees all their tenants", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerOrganization({
    organizationId: "org_multi_1",
    name: "Org Multi 1",
    defaultTenantId: "tenant_multi_1",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerOrganization({
    organizationId: "org_multi_2",
    name: "Org Multi 2",
    defaultTenantId: "tenant_multi_2",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_multi_1",
    organizationId: "org_multi_1",
    name: "Multi Tenant 1",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerTenant({
    tenantId: "tenant_multi_2",
    organizationId: "org_multi_2",
    name: "Multi Tenant 2",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerUser({
    userId: "user_multi",
    displayName: "Multi Tenant User",
    status: "active",
    identityProvider: "idp",
  });

  service.addOrganizationMembership({
    organizationId: "org_multi_1",
    userId: "user_multi",
    role: "member",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.registerWorkspace({
    workspaceId: "ws_multi_2",
    organizationId: "org_multi_2",
    name: "Workspace Multi 2",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  service.addWorkspaceMembership({
    workspaceId: "ws_multi_2",
    userId: "user_multi",
    role: "viewer",
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  const tenants = service.listTenantsForUser("user_multi");

  assert.equal(tenants.length, 2);
  assert.ok(tenants.some((t) => t.tenantId === "tenant_multi_1"));
  assert.ok(tenants.some((t) => t.tenantId === "tenant_multi_2"));
});

test("integration: cross-tenant access assertion throws", () => {
  const service = new TenantBoundaryRegistryService();

  assert.throws(
    () =>
      service.assertSameTenant({
        sourceTenantId: "tenant_x",
        targetTenantId: "tenant_y",
      }),
    /cross_tenant_denied/,
  );

  assert.doesNotThrow(() =>
    service.assertSameTenant({
      sourceTenantId: "tenant_z",
      targetTenantId: "tenant_z",
    }),
  );
});
