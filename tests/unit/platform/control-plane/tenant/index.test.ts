import assert from "node:assert/strict";
import test from "node:test";

import {
  TenantBoundaryRegistryService,
  type UserAccount,
  type TenantBoundaryTopologySeed,
  type TenantAccessDecision,
} from "../../../../../src/platform/control-plane/tenant/index.js";

test("TenantBoundaryRegistryService can be instantiated with no seed", () => {
  const service = new TenantBoundaryRegistryService();
  assert.ok(service !== undefined);
});

test("TenantBoundaryRegistryService can be instantiated with seed", () => {
  const seed: TenantBoundaryTopologySeed = {
    users: [{
      userId: "user-001",
      displayName: "Test User",
      status: "active",
      identityProvider: "idp-001",
    }],
  };
  const service = new TenantBoundaryRegistryService(seed);
  assert.ok(service !== undefined);
});

test("TenantBoundaryRegistryService registers user correctly", () => {
  const service = new TenantBoundaryRegistryService();
  const user = service.registerUser({
    userId: "user-001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp-001",
  });
  assert.equal(user.userId, "user-001");
  assert.equal(user.displayName, "Test User");
});

test("TenantBoundaryRegistryService sets createdAt when not provided", () => {
  const service = new TenantBoundaryRegistryService();
  const user = service.registerUser({
    userId: "user-002",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp-001",
  });
  assert.ok(user.createdAt !== undefined);
  assert.ok(user.createdAt.length > 0);
});

test("TenantBoundaryRegistryService uses provided createdAt", () => {
  const service = new TenantBoundaryRegistryService();
  const user = service.registerUser({
    userId: "user-003",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp-001",
    createdAt: "2024-01-15T10:00:00Z",
  });
  assert.equal(user.createdAt, "2024-01-15T10:00:00Z");
});

test("TenantBoundaryRegistryService registers workspace correctly", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization({
    organizationId: "org-001",
    name: "Test Org",
    createdAt: "2024-01-15T10:00:00Z",
  });
  const workspace = service.registerWorkspace({
    workspaceId: "ws-001",
    organizationId: "org-001",
    name: "Test Workspace",
    createdAt: "2024-01-15T10:00:00Z",
  });
  assert.equal(workspace.workspaceId, "ws-001");
});

test("TenantBoundaryRegistryService registers organization correctly", () => {
  const service = new TenantBoundaryRegistryService();
  const org = service.registerOrganization({
    organizationId: "org-001",
    name: "Test Org",
    createdAt: "2024-01-15T10:00:00Z",
  });
  assert.equal(org.organizationId, "org-001");
});

test("TenantBoundaryRegistryService listTenants returns empty initially", () => {
  const service = new TenantBoundaryRegistryService();
  const tenants = service.listTenants();
  assert.ok(Array.isArray(tenants));
  assert.equal(tenants.length, 0);
});

test("TenantBoundaryRegistryService listTenants returns registered tenants", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization({
    organizationId: "org-001",
    name: "Test Org",
    createdAt: "2024-01-15T10:00:00Z",
  });
  service.registerTenant({
    tenantId: "tenant-001",
    organizationId: "org-001",
    name: "Test Tenant",
    createdAt: "2024-01-15T10:00:00Z",
  });
  const tenants = service.listTenants();
  assert.equal(tenants.length, 1);
  assert.equal(tenants[0].tenantId, "tenant-001");
});

test("UserAccount type is correctly structured", () => {
  const user: UserAccount = {
    userId: "user-001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp-001",
    createdAt: "2024-01-15T10:00:00Z",
  };
  assert.equal(user.userId, "user-001");
  assert.equal(user.status, "active");
});

test("TenantAccessDecision type is correctly structured", () => {
  const decision: TenantAccessDecision = {
    decision: "allow",
    reasonCode: "tenant.member_allowed",
    userId: "user-001",
    tenantId: "tenant-001",
    workspaceId: null,
    organizationId: "org-001",
    governanceRef: null,
  };
  assert.equal(decision.decision, "allow");
  assert.equal(decision.reasonCode, "tenant.member_allowed");
});

test("TenantBoundaryTopologySeed allows partial inputs", () => {
  const seed: TenantBoundaryTopologySeed = {};
  const service = new TenantBoundaryRegistryService(seed);
  assert.ok(service !== undefined);
});

test("TenantBoundaryRegistryService adds workspace membership correctly", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser({
    userId: "user-001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp-001",
  });
  service.registerOrganization({
    organizationId: "org-001",
    name: "Test Org",
    createdAt: "2024-01-15T10:00:00Z",
  });
  service.registerWorkspace({
    workspaceId: "ws-001",
    organizationId: "org-001",
    name: "Test Workspace",
    createdAt: "2024-01-15T10:00:00Z",
  });
  const membership = service.addWorkspaceMembership({
    workspaceId: "ws-001",
    userId: "user-001",
    createdAt: "2024-01-15T10:00:00Z",
  });
  assert.equal(membership.workspaceId, "ws-001");
  assert.equal(membership.userId, "user-001");
});

test("TenantBoundaryRegistryService adds organization membership correctly", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerUser({
    userId: "user-001",
    displayName: "Test User",
    status: "active",
    identityProvider: "idp-001",
  });
  service.registerOrganization({
    organizationId: "org-001",
    name: "Test Org",
    createdAt: "2024-01-15T10:00:00Z",
  });
  const membership = service.addOrganizationMembership({
    organizationId: "org-001",
    userId: "user-001",
    createdAt: "2024-01-15T10:00:00Z",
  });
  assert.equal(membership.organizationId, "org-001");
  assert.equal(membership.userId, "user-001");
});

test("TenantBoundaryRegistryService registers deployment binding correctly", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization({
    organizationId: "org-001",
    name: "Test Org",
    createdAt: "2024-01-15T10:00:00Z",
  });
  service.registerTenant({
    tenantId: "tenant-001",
    organizationId: "org-001",
    name: "Test Tenant",
    createdAt: "2024-01-15T10:00:00Z",
  });
  const binding = service.registerDeploymentBinding({
    bindingId: "binding-001",
    tenantId: "tenant-001",
    deploymentId: "deploy-001",
    region: "us-east-1",
    createdAt: "2024-01-15T10:00:00Z",
  });
  assert.equal(binding.bindingId, "binding-001");
  assert.equal(binding.tenantId, "tenant-001");
});

test("TenantBoundaryRegistryService listDeploymentBindingsForTenant returns bindings", () => {
  const service = new TenantBoundaryRegistryService();
  service.registerOrganization({
    organizationId: "org-001",
    name: "Test Org",
    createdAt: "2024-01-15T10:00:00Z",
  });
  service.registerTenant({
    tenantId: "tenant-001",
    organizationId: "org-001",
    name: "Test Tenant",
    createdAt: "2024-01-15T10:00:00Z",
  });
  service.registerDeploymentBinding({
    bindingId: "binding-001",
    tenantId: "tenant-001",
    deploymentId: "deploy-001",
    region: "us-east-1",
    createdAt: "2024-01-15T10:00:00Z",
  });
  const bindings = service.listDeploymentBindingsForTenant("tenant-001");
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].bindingId, "binding-001");
});
