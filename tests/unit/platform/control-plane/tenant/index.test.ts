import assert from "node:assert/strict";
import test from "node:test";

import {
  TenantBoundaryRegistryService,
  type TenantBoundaryTopologySeed,
  type UserAccount,
} from "../../../../../src/platform/five-plane-control-plane/tenant/index.js";
import type {
  DeploymentBindingRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  TenantRecord,
  WorkspaceMembershipRecord,
  WorkspaceRecord,
} from "../../../../../src/platform/contracts/types/domain.js";

function makeOrganization(defaultTenantId: string | null = null): OrganizationRecord {
  return {
    organizationId: "org-001",
    displayName: "Test Org",
    billingAccountId: null,
    defaultTenantId,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  };
}

function makeWorkspace(): WorkspaceRecord {
  return {
    workspaceId: "ws-001",
    ownerId: "user-001",
    displayName: "Test Workspace",
    planId: "plan-free",
    defaultPolicySet: "default",
    organizationId: "org-001",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  };
}

function makeTenant(tenantId = "tenant-001"): TenantRecord {
  return {
    tenantId,
    organizationId: "org-001",
    displayName: "Test Tenant",
    storageScope: "tenant",
    identityScope: "tenant",
    policyScope: "tenant",
    artifactScope: "tenant",
    isolationMode: "shared_logical",
    deploymentMode: "cloud_shared",
    quotas: {},
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  };
}

function makeWorkspaceMembership(): WorkspaceMembershipRecord {
  return {
    workspaceId: "ws-001",
    userId: "user-001",
    role: "member",
    joinedAt: "2024-01-15T10:00:00Z",
  };
}

function makeOrganizationMembership(): OrganizationMembershipRecord {
  return {
    organizationId: "org-001",
    userId: "user-001",
    role: "member",
    joinedAt: "2024-01-15T10:00:00Z",
  };
}

function makeBinding(): DeploymentBindingRecord {
  return {
    bindingId: "binding-001",
    tenantId: "tenant-001",
    environmentId: "env-prod",
    deploymentMode: "cloud_shared",
    region: "us-east-1",
    networkBoundary: "shared-vpc",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  };
}

test("TenantBoundaryRegistryService accepts topology seed", () => {
  const user: UserAccount = {
    userId: "user-001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp-001",
    createdAt: "2024-01-15T10:00:00Z",
  };
  const seed: TenantBoundaryTopologySeed = {
    users: [user],
    organizations: [makeOrganization("tenant-001")],
    workspaces: [makeWorkspace()],
    tenants: [makeTenant()],
    workspaceMemberships: [makeWorkspaceMembership()],
    organizationMemberships: [makeOrganizationMembership()],
    deploymentBindings: [makeBinding()],
  };

  const service = new TenantBoundaryRegistryService(seed);
  assert.equal(service.listTenants().length, 1);
  assert.equal(service.listDeploymentBindingsForTenant("tenant-001").length, 1);
});

test("TenantBoundaryRegistryService registers topology records using current shapes", () => {
  const service = new TenantBoundaryRegistryService();

  service.registerUser({
    userId: "user-001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp-001",
  });
  service.registerOrganization(makeOrganization("tenant-001"));
  service.registerWorkspace(makeWorkspace());
  service.registerTenant(makeTenant());
  service.addWorkspaceMembership(makeWorkspaceMembership());
  service.addOrganizationMembership(makeOrganizationMembership());
  service.registerDeploymentBinding(makeBinding());

  assert.equal(service.listTenants().length, 1);
  assert.equal(service.listTenantsForUser("user-001")[0]?.tenantId, "tenant-001");
  assert.equal(service.listDeploymentBindingsForTenant("tenant-001")[0]?.bindingId, "binding-001");
});

test("TenantBoundaryRegistryService resolves workspace tenant from organization default", () => {
  const service = new TenantBoundaryRegistryService({
    organizations: [makeOrganization("tenant-001")],
    workspaces: [makeWorkspace()],
    tenants: [makeTenant()],
  });

  assert.equal(service.resolveTenantForWorkspace("ws-001")?.tenantId, "tenant-001");
});

test("TenantBoundaryRegistryService authorizes org and workspace membership access", () => {
  const service = new TenantBoundaryRegistryService({
    users: [{
      userId: "user-001",
      displayName: "Test User",
      status: "active",
      identityProvider: "idp-001",
      createdAt: "2024-01-15T10:00:00Z",
    }],
    organizations: [makeOrganization("tenant-001")],
    workspaces: [makeWorkspace()],
    tenants: [makeTenant()],
    organizationMemberships: [makeOrganizationMembership()],
    workspaceMemberships: [makeWorkspaceMembership()],
  });

  assert.equal(
    service.authorizeTenantAccess({ userId: "user-001", tenantId: "tenant-001" }).decision,
    "allow",
  );
  assert.equal(
    service.authorizeTenantAccess({ userId: "user-001", tenantId: "tenant-001", workspaceId: "ws-001" }).decision,
    "allow",
  );
});

test("TenantBoundaryRegistryService enforces disabled users, mismatched workspaces, and governance exceptions", () => {
  const service = new TenantBoundaryRegistryService({
    users: [{
      userId: "user-001",
      displayName: "Test User",
      status: "disabled",
      identityProvider: "idp-001",
      createdAt: "2024-01-15T10:00:00Z",
    }],
    organizations: [
      makeOrganization("tenant-001"),
      {
        organizationId: "org-002",
        displayName: "Other Org",
        billingAccountId: null,
        defaultTenantId: "tenant-002",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
      },
    ],
    workspaces: [
      makeWorkspace(),
      {
        workspaceId: "ws-002",
        ownerId: "user-001",
        displayName: "Other Workspace",
        planId: "plan-free",
        defaultPolicySet: "default",
        organizationId: "org-002",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
      },
    ],
    tenants: [
      makeTenant("tenant-001"),
      {
        ...makeTenant("tenant-002"),
        organizationId: "org-002",
      },
    ],
  });

  assert.equal(
    service.authorizeTenantAccess({ userId: "user-001", tenantId: "tenant-001" }).reasonCode,
    "tenant.user_disabled",
  );

  service.registerUser({
    userId: "user-002",
    displayName: "Active User",
    status: "active",
    identityProvider: "idp-001",
  });
  assert.equal(
    service.authorizeTenantAccess({ userId: "user-002", tenantId: "tenant-001", workspaceId: "ws-002" }).reasonCode,
    "tenant.workspace_tenant_mismatch",
  );
  assert.equal(
    service.authorizeTenantAccess({
      userId: "user-002",
      tenantId: "tenant-001",
      governanceRef: "gov-exception-001",
    }).decision,
    "allow_with_governance_exception",
  );
});

test("TenantBoundaryRegistryService assertSameTenant uses fail-closed behavior", () => {
  const service = new TenantBoundaryRegistryService();
  service.assertSameTenant({ sourceTenantId: "tenant-001", targetTenantId: "tenant-001" });
  assert.throws(() => service.assertSameTenant({ sourceTenantId: "tenant-001", targetTenantId: "tenant-002" }));
  assert.throws(() => service.assertSameTenant({ sourceTenantId: null, targetTenantId: "tenant-001" }));
});
