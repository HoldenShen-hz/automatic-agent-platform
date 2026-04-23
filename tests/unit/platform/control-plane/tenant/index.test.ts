import assert from "node:assert/strict";
import test from "node:test";

import { TenantBoundaryRegistryService } from "../../../../../src/platform/control-plane/tenant/index.js";
import type {
  DeploymentBindingRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  TenantRecord,
  WorkspaceMembershipRecord,
  WorkspaceRecord,
} from "../../../../../src/platform/contracts/types/domain.js";
import { TenantBoundaryError, ValidationError } from "../../../../../src/platform/contracts/errors.js";

function makeUser(userId: string, overrides = {}): {
  userId: string;
  displayName: string;
  identityProvider: string;
  status: "active" | "disabled";
  createdAt: string;
} {
  return {
    userId,
    displayName: `User ${userId}`,
    identityProvider: "idp1",
    status: "active",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWorkspace(workspaceId: string, overrides: Partial<WorkspaceRecord> = {}): WorkspaceRecord {
  return {
    workspaceId,
    ownerId: "owner1",
    displayName: `Workspace ${workspaceId}`,
    planId: "plan1",
    defaultPolicySet: "default",
    organizationId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeOrganization(organizationId: string, overrides: Partial<OrganizationRecord> = {}): OrganizationRecord {
  return {
    organizationId,
    displayName: `Org ${organizationId}`,
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTenant(tenantId: string, organizationId: string, overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    tenantId,
    organizationId,
    storageScope: "global",
    identityScope: "global",
    policyScope: "global",
    artifactScope: "global",
    isolationMode: "shared",
    deploymentMode: "cloud",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeDeploymentBinding(bindingId: string, tenantId: string): DeploymentBindingRecord {
  return {
    bindingId,
    tenantId,
    environmentId: "env1",
    deploymentMode: "cloud",
    region: "us-east-1",
    networkBoundary: "public",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

function makeWorkspaceMembership(workspaceId: string, userId: string): WorkspaceMembershipRecord {
  return {
    workspaceId,
    userId,
    role: "member",
    joinedAt: "2024-01-01T00:00:00.000Z",
  };
}

function makeOrganizationMembership(organizationId: string, userId: string): OrganizationMembershipRecord {
  return {
    organizationId,
    userId,
    role: "member",
    joinedAt: "2024-01-01T00:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// User registration
// ---------------------------------------------------------------------------

test("registerUser accepts valid user and returns UserAccount", () => {
  const service = new TenantBoundaryRegistryService();
  const result = service.registerUser({ userId: "user1", displayName: "Alice", identityProvider: "idp1", status: "active" });

  assert.equal(result.userId, "user1");
  assert.equal(result.displayName, "Alice");
  assert.equal(result.identityProvider, "idp1");
  assert.equal(result.status, "active");
  assert.ok(result.createdAt.length > 0);
});

test("registerUser uses provided createdAt when given", () => {
  const service = new TenantBoundaryRegistryService();
  const createdAt = "2023-06-15T10:00:00.000Z";
  const result = service.registerUser({
    userId: "user1",
    displayName: "Alice",
    identityProvider: "idp1",
    status: "active",
    createdAt,
  });

  assert.equal(result.createdAt, createdAt);
});

test("registerUser rejects invalid userId", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(
    () => service.registerUser({ userId: "invalid user!", displayName: "Alice", identityProvider: "idp1", status: "active" }),
    ValidationError,
  );
});

test("registerUser rejects empty displayName", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(
    () => service.registerUser({ userId: "user1", displayName: "   ", identityProvider: "idp1", status: "active" }),
    ValidationError,
  );
});

test("registerUser rejects invalid identityProvider", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(
    () => service.registerUser({ userId: "user1", displayName: "Alice", identityProvider: "idp with space", status: "active" }),
    ValidationError,
  );
});

// ---------------------------------------------------------------------------
// Workspace registration
// ---------------------------------------------------------------------------

test("registerWorkspace accepts valid workspace", () => {
  const service = new TenantBoundaryRegistryService();
  const workspace = makeWorkspace("ws1");
  const result = service.registerWorkspace(workspace);
  assert.equal(result.workspaceId, "ws1");
});

test("registerWorkspace rejects invalid workspaceId", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.registerWorkspace(makeWorkspace("invalid workspace!")), ValidationError);
});

test("registerWorkspace requires organization when organizationId is set", () => {
  const service = new TenantBoundaryRegistryService();
  const workspace = makeWorkspace("ws1", { organizationId: "org1" });
  assert.throws(() => service.registerWorkspace(workspace), ValidationError);
});

test("registerWorkspace succeeds when organization exists", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  const workspace = makeWorkspace("ws1", { organizationId: "org1" });
  const result = service.registerWorkspace(workspace);
  assert.equal(result.workspaceId, "ws1");
});

// ---------------------------------------------------------------------------
// Organization registration
// ---------------------------------------------------------------------------

test("registerOrganization accepts valid organization", () => {
  const service = new TenantBoundaryRegistryService();
  const org = makeOrganization("org1");
  const result = service.registerOrganization(org);
  assert.equal(result.organizationId, "org1");
});

test("registerOrganization rejects invalid organizationId", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.registerOrganization(makeOrganization("invalid org!")), ValidationError);
});

// ---------------------------------------------------------------------------
// Tenant registration
// ---------------------------------------------------------------------------

test("registerTenant accepts valid tenant with existing organization", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  const tenant = makeTenant("tenant1", "org1");
  const result = service.registerTenant(tenant);
  assert.equal(result.tenantId, "tenant1");
});

test("registerTenant rejects invalid tenantId", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.registerTenant(makeTenant("invalid tenant!", "org1")), ValidationError);
});

test("registerTenant requires organization to exist", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.registerTenant(makeTenant("tenant1", "nonexistent")), ValidationError);
});

// ---------------------------------------------------------------------------
// Deployment binding registration
// ---------------------------------------------------------------------------

test("registerDeploymentBinding accepts valid binding with existing tenant", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  const binding = makeDeploymentBinding("binding1", "tenant1");
  const result = service.registerDeploymentBinding(binding);
  assert.equal(result.bindingId, "binding1");
});

test("registerDeploymentBinding requires tenant to exist", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.registerDeploymentBinding(makeDeploymentBinding("binding1", "nonexistent")), ValidationError);
});

// ---------------------------------------------------------------------------
// Workspace membership
// ---------------------------------------------------------------------------

test("addWorkspaceMembership accepts valid membership", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerWorkspace(makeWorkspace("ws1", { organizationId: "org1" }));
  const membership = makeWorkspaceMembership("ws1", "user1");
  const result = service.addWorkspaceMembership(membership);
  assert.equal(result.workspaceId, "ws1");
  assert.equal(result.userId, "user1");
});

test("addWorkspaceMembership requires user to exist", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  service.registerWorkspace(makeWorkspace("ws1", { organizationId: "org1" }));
  assert.throws(() => service.addWorkspaceMembership(makeWorkspaceMembership("ws1", "nonexistent")), ValidationError);
});

test("addWorkspaceMembership requires workspace to exist", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  assert.throws(() => service.addWorkspaceMembership(makeWorkspaceMembership("nonexistent", "user1")), ValidationError);
});

// ---------------------------------------------------------------------------
// Organization membership
// ---------------------------------------------------------------------------

test("addOrganizationMembership accepts valid membership", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  const membership = makeOrganizationMembership("org1", "user1");
  const result = service.addOrganizationMembership(membership);
  assert.equal(result.organizationId, "org1");
  assert.equal(result.userId, "user1");
});

test("addOrganizationMembership requires user to exist", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  assert.throws(() => service.addOrganizationMembership(makeOrganizationMembership("org1", "nonexistent")), ValidationError);
});

test("addOrganizationMembership requires organization to exist", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  assert.throws(() => service.addOrganizationMembership(makeOrganizationMembership("nonexistent", "user1")), ValidationError);
});

// ---------------------------------------------------------------------------
// Resolve tenant for workspace
// ---------------------------------------------------------------------------

test("resolveTenantForWorkspace returns tenant when organization has defaultTenantId", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1", { defaultTenantId: "tenant1" }));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.registerWorkspace(makeWorkspace("ws1", { organizationId: "org1" }));

  const result = service.resolveTenantForWorkspace("ws1");
  assert.ok(result != null);
  assert.equal(result.tenantId, "tenant1");
});

test("resolveTenantForWorkspace returns null when organization has no defaultTenantId", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1", { defaultTenantId: null }));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.registerWorkspace(makeWorkspace("ws1", { organizationId: "org1" }));

  const result = service.resolveTenantForWorkspace("ws1");
  assert.equal(result, null);
});

test("resolveTenantForWorkspace returns null when workspace has no organizationId", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerWorkspace(makeWorkspace("ws1", { organizationId: null }));

  const result = service.resolveTenantForWorkspace("ws1");
  assert.equal(result, null);
});

test("resolveTenantForWorkspace throws when workspace not found", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.resolveTenantForWorkspace("nonexistent"), ValidationError);
});

// ---------------------------------------------------------------------------
// Authorize tenant access
// ---------------------------------------------------------------------------

test("authorizeTenantAccess allows org member", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.addOrganizationMembership(makeOrganizationMembership("org1", "user1"));

  const decision = service.authorizeTenantAccess({ userId: "user1", tenantId: "tenant1" });
  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "tenant.member_allowed");
});

test("authorizeTenantAccess allows workspace member in same org", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.registerWorkspace(makeWorkspace("ws1", { organizationId: "org1" }));
  service.addWorkspaceMembership(makeWorkspaceMembership("ws1", "user1"));

  const decision = service.authorizeTenantAccess({ userId: "user1", tenantId: "tenant1" });
  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "tenant.member_allowed");
});

test("authorizeTenantAccess denies disabled user", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1", { status: "disabled" }));
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.addOrganizationMembership(makeOrganizationMembership("org1", "user1"));

  const decision = service.authorizeTenantAccess({ userId: "user1", tenantId: "tenant1" });
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "tenant.user_disabled");
});

test("authorizeTenantAccess denies workspace from different org", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerOrganization(makeOrganization("org2"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.registerWorkspace(makeWorkspace("ws1", { organizationId: "org2" }));
  service.addWorkspaceMembership(makeWorkspaceMembership("ws1", "user1"));

  const decision = service.authorizeTenantAccess({ userId: "user1", tenantId: "tenant1", workspaceId: "ws1" });
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "tenant.workspace_tenant_mismatch");
});

test("authorizeTenantAccess allows with governance exception", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));

  const decision = service.authorizeTenantAccess({
    userId: "user1",
    tenantId: "tenant1",
    governanceRef: "gov-ref-123",
  });
  assert.equal(decision.decision, "allow_with_governance_exception");
  assert.equal(decision.reasonCode, "tenant.governance_exception");
});

test("authorizeTenantAccess denies by default when not a member", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));

  const decision = service.authorizeTenantAccess({ userId: "user1", tenantId: "tenant1" });
  assert.equal(decision.decision, "deny");
  assert.equal(decision.reasonCode, "tenant.default_deny");
});

test("authorizeTenantAccess throws when user not found", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));

  assert.throws(() => service.authorizeTenantAccess({ userId: "nonexistent", tenantId: "tenant1" }), ValidationError);
});

test("authorizeTenantAccess throws when tenant not found", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));

  assert.throws(() => service.authorizeTenantAccess({ userId: "user1", tenantId: "nonexistent" }), ValidationError);
});

// ---------------------------------------------------------------------------
// Assert same tenant
// ---------------------------------------------------------------------------

test("assertSameTenant passes when tenant IDs match", () => {
  const service = new TenantBoundaryRegistryService();
  service.assertSameTenant({ sourceTenantId: "tenant1", targetTenantId: "tenant1" });
});

test("assertSameTenant passes when both are null", () => {
  const service = new TenantBoundaryRegistryService();
  service.assertSameTenant({ sourceTenantId: null, targetTenantId: null });
});

test("assertSameTenant throws when sourceTenantId is null", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(
    () => service.assertSameTenant({ sourceTenantId: null, targetTenantId: "tenant1" }),
    TenantBoundaryError,
  );
});

test("assertSameTenant throws when targetTenantId is null", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(
    () => service.assertSameTenant({ sourceTenantId: "tenant1", targetTenantId: null }),
    TenantBoundaryError,
  );
});

test("assertSameTenant throws when tenant IDs differ", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(
    () => service.assertSameTenant({ sourceTenantId: "tenant1", targetTenantId: "tenant2" }),
    TenantBoundaryError,
  );
});

test("assertSameTenant uses custom reason code when provided", () => {
  const service = new TenantBoundaryRegistryService();
  try {
    service.assertSameTenant({ sourceTenantId: "tenant1", targetTenantId: "tenant2", reasonCode: "custom.reason" });
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof TenantBoundaryError);
    assert.equal((err as TenantBoundaryError).reasonCode, "custom.reason");
  }
});

// ---------------------------------------------------------------------------
// List deployment bindings for tenant
// ---------------------------------------------------------------------------

test("listDeploymentBindingsForTenant returns bindings for tenant", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.registerDeploymentBinding(makeDeploymentBinding("binding1", "tenant1"));
  service.registerDeploymentBinding(makeDeploymentBinding("binding2", "tenant1"));
  service.registerDeploymentBinding(makeDeploymentBinding("binding3", "tenant2"));

  const bindings = service.listDeploymentBindingsForTenant("tenant1");
  assert.equal(bindings.length, 2);
  assert.ok(bindings.every((b) => b.tenantId === "tenant1"));
});

test("listDeploymentBindingsForTenant throws when tenant not found", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.listDeploymentBindingsForTenant("nonexistent"), ValidationError);
});

// ---------------------------------------------------------------------------
// List tenants for user
// ---------------------------------------------------------------------------

test("listTenantsForUser returns tenants via org membership", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.addOrganizationMembership(makeOrganizationMembership("org1", "user1"));

  const tenants = service.listTenantsForUser("user1");
  assert.equal(tenants.length, 1);
  assert.equal(tenants[0].tenantId, "tenant1");
});

test("listTenantsForUser returns tenants via workspace membership", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.registerWorkspace(makeWorkspace("ws1", { organizationId: "org1" }));
  service.addWorkspaceMembership(makeWorkspaceMembership("ws1", "user1"));

  const tenants = service.listTenantsForUser("user1");
  assert.equal(tenants.length, 1);
  assert.equal(tenants[0].tenantId, "tenant1");
});

test("listTenantsForUser returns multiple tenants from different orgs", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser(makeUser("user1"));
  service.registerOrganization(makeOrganization("org1"));
  service.registerOrganization(makeOrganization("org2"));
  service.registerTenant(makeTenant("tenant1", "org1"));
  service.registerTenant(makeTenant("tenant2", "org2"));
  service.addOrganizationMembership(makeOrganizationMembership("org1", "user1"));
  service.addOrganizationMembership(makeOrganizationMembership("org2", "user1"));

  const tenants = service.listTenantsForUser("user1");
  assert.equal(tenants.length, 2);
});

test("listTenantsForUser throws when user not found", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.listTenantsForUser("nonexistent"), ValidationError);
});

// ---------------------------------------------------------------------------
// List tenants
// ---------------------------------------------------------------------------

test("listTenants returns all tenants sorted by createdAt desc", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1", { createdAt: "2024-01-01T00:00:00.000Z" }));
  service.registerTenant(makeTenant("tenant2", "org1", { createdAt: "2024-01-02T00:00:00.000Z" }));

  const tenants = service.listTenants();
  assert.equal(tenants.length, 2);
  assert.equal(tenants[0].tenantId, "tenant2");
  assert.equal(tenants[1].tenantId, "tenant1");
});

test("listTenants respects limit parameter", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  service.registerTenant(makeTenant("tenant1", "org1", { createdAt: "2024-01-01T00:00:00.000Z" }));
  service.registerTenant(makeTenant("tenant2", "org1", { createdAt: "2024-01-02T00:00:00.000Z" }));
  service.registerTenant(makeTenant("tenant3", "org1", { createdAt: "2024-01-03T00:00:00.000Z" }));

  const tenants = service.listTenants(2);
  assert.equal(tenants.length, 2);
});

test("listTenants uses default limit of 50", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization(makeOrganization("org1"));
  for (let i = 0; i < 60; i++) {
    service.registerTenant(makeTenant("tenant" + i, "org1", { createdAt: "2024-01-" + String(i + 1).padStart(2, "0") + "T00:00:00.000Z" }));
  }

  const tenants = service.listTenants();
  assert.equal(tenants.length, 50);
});

test("listTenants returns empty array when no tenants", () => {
  const service = new TenantBoundaryRegistryService();
  const tenants = service.listTenants();
  assert.equal(tenants.length, 0);
});

// ---------------------------------------------------------------------------
// Seed via constructor
// ---------------------------------------------------------------------------

test("constructor accepts seed with all entity types", () => {
  const service = new TenantBoundaryRegistryService({
    users: [{ userId: "user1", displayName: "Alice", identityProvider: "idp1", status: "active" }],
    organizations: [makeOrganization("org1")],
    tenants: [makeTenant("tenant1", "org1")],
    workspaces: [makeWorkspace("ws1", { organizationId: "org1" })],
    workspaceMemberships: [makeWorkspaceMembership("ws1", "user1")],
    organizationMemberships: [makeOrganizationMembership("org1", "user1")],
    deploymentBindings: [makeDeploymentBinding("binding1", "tenant1")],
  });

  const tenants = service.listTenants();
  assert.equal(tenants.length, 1);
  const decision = service.authorizeTenantAccess({ userId: "user1", tenantId: "tenant1" });
  assert.equal(decision.decision, "allow");
});

// ---------------------------------------------------------------------------
// ID validation edge cases
// ---------------------------------------------------------------------------

test("registerUser accepts valid ID characters (alphanumeric, dot, underscore, hyphen, colon)", () => {
  const service = new TenantBoundaryRegistryService();
  const validIds = ["user.1", "user_2", "user-3", "user:4", "a", "A", "1234567890"];
  for (const id of validIds) {
    service.registerUser({ userId: id, displayName: "Test", identityProvider: "idp1", status: "active" });
  }
  assert.equal(validIds.length, 7);
});

test("registerUser rejects IDs shorter than 2 characters", () => {
  const service = new TenantBoundaryRegistryService();
  assert.throws(() => service.registerUser({ userId: "u", displayName: "Test", identityProvider: "idp1", status: "active" }), ValidationError);
});

test("registerUser rejects IDs longer than 128 characters", () => {
  const service = new TenantBoundaryRegistryService();
  const longId = "a".repeat(129);
  assert.throws(() => service.registerUser({ userId: longId, displayName: "Test", identityProvider: "idp1", status: "active" }), ValidationError);
});
