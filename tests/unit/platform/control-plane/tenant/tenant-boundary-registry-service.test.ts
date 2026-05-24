import assert from "node:assert/strict";
import test from "node:test";

import { TenantBoundaryRegistryService } from "../../../../../src/platform/five-plane-control-plane/tenant/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import type {
  DeploymentBindingRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  TenantRecord,
  WorkspaceMembershipRecord,
  WorkspaceRecord,
} from "../../../../../src/platform/contracts/types/domain.js";

function makeOrganization(defaultTenantId: string | null = "tenant_123"): OrganizationRecord {
  return {
    organizationId: "org_123",
    displayName: "Test Org",
    billingAccountId: null,
    defaultTenantId,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

function makeTenant(tenantId = "tenant_123", organizationId = "org_123"): TenantRecord {
  return {
    tenantId,
    organizationId,
    displayName: `Tenant ${tenantId}`,
    storageScope: "tenant",
    identityScope: "tenant",
    policyScope: "tenant",
    artifactScope: "tenant",
    isolationMode: "shared_logical",
    deploymentMode: "cloud_shared",
    quotas: {},
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

function makeWorkspace(organizationId = "org_123"): WorkspaceRecord {
  return {
    workspaceId: "ws_123",
    ownerId: "owner_1",
    displayName: "Test Workspace",
    planId: "plan_free",
    defaultPolicySet: "default",
    organizationId,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

function makeWorkspaceMembership(userId = "user_123"): WorkspaceMembershipRecord {
  return {
    workspaceId: "ws_123",
    userId,
    role: "member",
    joinedAt: "2026-04-01T00:00:00.000Z",
  };
}

function makeOrganizationMembership(userId = "user_123"): OrganizationMembershipRecord {
  return {
    organizationId: "org_123",
    userId,
    role: "member",
    joinedAt: "2026-04-01T00:00:00.000Z",
  };
}

function makeBinding(tenantId = "tenant_123"): DeploymentBindingRecord {
  return {
    bindingId: "binding_123",
    tenantId,
    environmentId: "env_prod",
    deploymentMode: "cloud_shared",
    region: "us-east-1",
    networkBoundary: "shared-vpc",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

test("TenantBoundaryRegistryService registers current canonical tenant topology", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user_123",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp_1",
  });
  service.registerOrganization(makeOrganization());
  service.registerWorkspace(makeWorkspace());
  service.registerTenant(makeTenant());
  service.addWorkspaceMembership(makeWorkspaceMembership());
  service.addOrganizationMembership(makeOrganizationMembership());
  service.registerDeploymentBinding(makeBinding());

  assert.equal(service.listTenants()[0]?.tenantId, "tenant_123");
  assert.equal(service.resolveTenantForWorkspace("ws_123")?.tenantId, "tenant_123");
  assert.equal(service.listDeploymentBindingsForTenant("tenant_123")[0]?.bindingId, "binding_123");
});

test("TenantBoundaryRegistryService authorizes members and governance exceptions", () => {
  const service = new TenantBoundaryRegistryService({
    users: [{
      userId: "user_123",
      displayName: "Test User",
      status: "active",
      identityProvider: "idp_1",
      createdAt: "2026-04-01T00:00:00.000Z",
    }],
    organizations: [makeOrganization()],
    workspaces: [makeWorkspace()],
    tenants: [makeTenant()],
    workspaceMemberships: [makeWorkspaceMembership()],
    organizationMemberships: [makeOrganizationMembership()],
  });

  assert.equal(service.authorizeTenantAccess({ userId: "user_123", tenantId: "tenant_123" }).decision, "allow");
  assert.throws(
    () => service.authorizeTenantAccess({
      userId: "user_missing",
      tenantId: "tenant_123",
      governanceRef: "gov_123",
    }),
    (error: unknown) => error instanceof ValidationError && error.code === "tenant.user_not_found",
  );
});

test("TenantBoundaryRegistryService denies workspace and tenant mismatches by default", () => {
  const service = new TenantBoundaryRegistryService({
    users: [{
      userId: "user_123",
      displayName: "Test User",
      status: "active",
      identityProvider: "idp_1",
      createdAt: "2026-04-01T00:00:00.000Z",
    }],
    organizations: [
      makeOrganization(),
      {
        organizationId: "org_456",
        displayName: "Other Org",
        billingAccountId: null,
        defaultTenantId: "tenant_456",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    workspaces: [makeWorkspace("org_456")],
    tenants: [makeTenant(), makeTenant("tenant_456", "org_456")],
  });

  assert.equal(
    service.authorizeTenantAccess({ userId: "user_123", tenantId: "tenant_123", workspaceId: "ws_123" }).reasonCode,
    "tenant.workspace_tenant_mismatch",
  );
  assert.throws(() => service.assertSameTenant({ sourceTenantId: "tenant_123", targetTenantId: "tenant_456" }));
});
