import assert from "node:assert/strict";
import test from "node:test";

import { TenantBoundaryRegistryService } from "../../../../src/platform/five-plane-control-plane/tenant/index.js";

function createService() {
  return new TenantBoundaryRegistryService();
}

function registerBaseline(service: TenantBoundaryRegistryService) {
  service.registerUser({
    userId: "user_001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp_001",
  });
  service.registerOrganization({
    organizationId: "org_001",
    displayName: "Test Org",
    billingAccountId: "billing_001",
    defaultTenantId: "tenant_001",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  });
  service.registerTenant({
    tenantId: "tenant_001",
    organizationId: "org_001",
    displayName: "Primary Tenant",
    storageScope: "storage://tenant_001",
    identityScope: "identity://tenant_001",
    policyScope: "policy://tenant_001",
    artifactScope: "artifact://tenant_001",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "private_cloud",
    quotas: {},
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  });
  service.registerWorkspace({
    workspaceId: "ws_001",
    ownerId: "user_001",
    displayName: "Workspace One",
    planId: "plan.standard",
    defaultPolicySet: "policy.default",
    organizationId: "org_001",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  });
}

test("TenantBoundaryRegistryService registers users and preserves generated metadata", () => {
  const service = createService();

  const user = service.registerUser({
    userId: "user_001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp_001",
  });

  assert.equal(user.userId, "user_001");
  assert.equal(user.displayName, "Test User");
  assert.equal(user.status, "active");
  assert.ok(user.createdAt.length > 0);
});

test("TenantBoundaryRegistryService resolves the default tenant for a workspace", () => {
  const service = createService();
  registerBaseline(service);

  const tenant = service.resolveTenantForWorkspace("ws_001");

  assert.equal(tenant?.tenantId, "tenant_001");
  assert.equal(tenant?.organizationId, "org_001");
});

test("TenantBoundaryRegistryService authorizes organization and workspace members", () => {
  const service = createService();
  registerBaseline(service);

  service.addOrganizationMembership({
    organizationId: "org_001",
    userId: "user_001",
    role: "member",
    joinedAt: "2026-04-29T00:00:00.000Z",
  });
  service.addWorkspaceMembership({
    workspaceId: "ws_001",
    userId: "user_001",
    role: "member",
    joinedAt: "2026-04-29T00:00:00.000Z",
  });

  const decision = service.authorizeTenantAccess({
    userId: "user_001",
    tenantId: "tenant_001",
    workspaceId: "ws_001",
  });
  const tenants = service.listTenantsForUser("user_001");

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "tenant.member_allowed");
  assert.deepEqual(tenants.map((tenant) => tenant.tenantId), ["tenant_001"]);
});

test("TenantBoundaryRegistryService denies disabled users and cross-tenant workspace mismatches", () => {
  const service = createService();
  registerBaseline(service);
  service.registerUser({
    userId: "user_disabled",
    displayName: "Disabled User",
    status: "disabled",
    identityProvider: "idp_disabled",
  });
  service.registerOrganization({
    organizationId: "org_002",
    displayName: "Other Org",
    billingAccountId: null,
    defaultTenantId: "tenant_002",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  });
  service.registerTenant({
    tenantId: "tenant_002",
    organizationId: "org_002",
    storageScope: "storage://tenant_002",
    identityScope: "identity://tenant_002",
    policyScope: "policy://tenant_002",
    artifactScope: "artifact://tenant_002",
    isolationMode: "shared_hard_scoped",
    deploymentMode: "cloud_shared",
    quotas: {},
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  });

  const disabledDecision = service.authorizeTenantAccess({
    userId: "user_disabled",
    tenantId: "tenant_001",
  });
  const mismatchDecision = service.authorizeTenantAccess({
    userId: "user_001",
    tenantId: "tenant_002",
    workspaceId: "ws_001",
  });

  assert.equal(disabledDecision.decision, "deny");
  assert.equal(disabledDecision.reasonCode, "tenant.user_disabled");
  assert.equal(mismatchDecision.decision, "deny");
  assert.equal(mismatchDecision.reasonCode, "tenant.workspace_tenant_mismatch");
});

test("TenantBoundaryRegistryService supports governance exceptions and deployment bindings", () => {
  const service = createService();
  registerBaseline(service);

  const exceptionDecision = service.authorizeTenantAccess({
    userId: "user_001",
    tenantId: "tenant_001",
    governanceRef: "gov_exception_001",
  });

  service.registerDeploymentBinding({
    bindingId: "binding_001",
    tenantId: "tenant_001",
    environmentId: "env_001",
    deploymentMode: "private_cloud",
    region: "cn-sha",
    networkBoundary: "private",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  });
  const bindings = service.listDeploymentBindingsForTenant("tenant_001");

  assert.equal(exceptionDecision.decision, "allow_with_governance_exception");
  assert.equal(exceptionDecision.governanceRef, "gov_exception_001");
  assert.equal(bindings[0]?.bindingId, "binding_001");
});

test("TenantBoundaryRegistryService enforces same-tenant assertions", () => {
  const service = createService();

  assert.doesNotThrow(() => service.assertSameTenant({
    sourceTenantId: "tenant_001",
    targetTenantId: "tenant_001",
  }));
  assert.throws(
    () => service.assertSameTenant({
      sourceTenantId: "tenant_001",
      targetTenantId: "tenant_002",
    }),
    /Cross-tenant access is denied by default/,
  );
});
