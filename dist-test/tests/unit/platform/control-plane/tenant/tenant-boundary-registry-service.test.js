import assert from "node:assert/strict";
import test from "node:test";
import { TenantBoundaryRegistryService } from "../../../../../src/platform/control-plane/tenant/index.js";
test("TenantBoundaryRegistryService registers and retrieves a user", () => {
    const service = new TenantBoundaryRegistryService();
    const user = service.registerUser({
        userId: "user_123",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    assert.equal(user.userId, "user_123");
    assert.equal(user.displayName, "Test User");
    assert.equal(user.status, "active");
    assert.equal(user.identityProvider, "idp_1");
    assert.ok(user.createdAt.length > 0);
});
test("TenantBoundaryRegistryService registers user with custom createdAt", () => {
    const service = new TenantBoundaryRegistryService();
    const customDate = "2026-01-15T10:00:00.000Z";
    const user = service.registerUser({
        userId: "user_456",
        displayName: "Custom Date User",
        status: "active",
        identityProvider: "idp_1",
        createdAt: customDate,
    });
    assert.equal(user.createdAt, customDate);
});
test("TenantBoundaryRegistryService registers and retrieves an organization", () => {
    const service = new TenantBoundaryRegistryService();
    const org = {
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const result = service.registerOrganization(org);
    assert.equal(result.organizationId, "org_123");
    assert.equal(result.displayName, "Test Org");
});
test("TenantBoundaryRegistryService registers and retrieves a workspace", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const workspace = {
        workspaceId: "ws_123",
        ownerId: "owner_1",
        displayName: "Test Workspace",
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: "org_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const result = service.registerWorkspace(workspace);
    assert.equal(result.workspaceId, "ws_123");
    assert.equal(result.organizationId, "org_123");
});
test("TenantBoundaryRegistryService registers and retrieves a tenant", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const tenant = {
        tenantId: "tenant_123",
        organizationId: "org_123",
        displayName: "Test Tenant",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const result = service.registerTenant(tenant);
    assert.equal(result.tenantId, "tenant_123");
    assert.equal(result.organizationId, "org_123");
});
test("TenantBoundaryRegistryService resolves tenant for workspace", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerWorkspace({
        workspaceId: "ws_123",
        ownerId: "owner_1",
        displayName: "Test Workspace",
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: "org_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const tenant = service.resolveTenantForWorkspace("ws_123");
    assert.ok(tenant !== null);
    assert.equal(tenant.tenantId, "tenant_123");
});
test("TenantBoundaryRegistryService returns null for workspace without org default tenant", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerWorkspace({
        workspaceId: "ws_123",
        ownerId: "owner_1",
        displayName: "Test Workspace",
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: "org_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const tenant = service.resolveTenantForWorkspace("ws_123");
    assert.equal(tenant, null);
});
test("TenantBoundaryRegistryService authorizes tenant access for org member", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_123",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.addOrganizationMembership({
        userId: "user_123",
        organizationId: "org_123",
        role: "member",
        joinedAt: "2026-04-01T00:00:00.000Z",
    });
    const decision = service.authorizeTenantAccess({
        userId: "user_123",
        tenantId: "tenant_123",
    });
    assert.equal(decision.decision, "allow");
    assert.equal(decision.reasonCode, "tenant.member_allowed");
    assert.equal(decision.userId, "user_123");
    assert.equal(decision.tenantId, "tenant_123");
});
test("TenantBoundaryRegistryService denies access for disabled user", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_123",
        displayName: "Test User",
        status: "disabled",
        identityProvider: "idp_1",
    });
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const decision = service.authorizeTenantAccess({
        userId: "user_123",
        tenantId: "tenant_123",
    });
    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "tenant.user_disabled");
});
test("TenantBoundaryRegistryService allows access with governance exception", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_123",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const decision = service.authorizeTenantAccess({
        userId: "user_123",
        tenantId: "tenant_123",
        governanceRef: "gov_exception_123",
    });
    assert.equal(decision.decision, "allow_with_governance_exception");
    assert.equal(decision.reasonCode, "tenant.governance_exception");
});
test("TenantBoundaryRegistryService denies cross-tenant workspace access", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_123",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerOrganization({
        organizationId: "org_456",
        displayName: "Other Org",
        billingAccountId: null,
        defaultTenantId: "tenant_456",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_456",
        organizationId: "org_456",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerWorkspace({
        workspaceId: "ws_123",
        ownerId: "owner_1",
        displayName: "Test Workspace",
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: "org_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    // User is org member of org_123, but accessing tenant_456 with workspace_123
    service.addOrganizationMembership({
        userId: "user_123",
        organizationId: "org_123",
        role: "member",
        joinedAt: "2026-04-01T00:00:00.000Z",
    });
    const decision = service.authorizeTenantAccess({
        userId: "user_123",
        tenantId: "tenant_456",
        workspaceId: "ws_123",
    });
    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "tenant.workspace_tenant_mismatch");
});
test("TenantBoundaryRegistryService denies by default when no membership", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_123",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const decision = service.authorizeTenantAccess({
        userId: "user_123",
        tenantId: "tenant_123",
    });
    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "tenant.default_deny");
});
test("TenantBoundaryRegistryService asserts same tenant throws on mismatch", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.assertSameTenant({
        sourceTenantId: "tenant_123",
        targetTenantId: "tenant_456",
    }), (error) => error instanceof Error && error.message.includes("Cross-tenant access is denied"));
});
test("TenantBoundaryRegistryService asserts same tenant allows matching tenants", () => {
    const service = new TenantBoundaryRegistryService();
    assert.doesNotThrow(() => service.assertSameTenant({
        sourceTenantId: "tenant_123",
        targetTenantId: "tenant_123",
    }));
});
test("TenantBoundaryRegistryService lists deployment bindings for tenant", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerDeploymentBinding({
        bindingId: "binding_1",
        tenantId: "tenant_123",
        environmentId: "env_1",
        deploymentMode: "cloud_shared",
        region: "us-east-1",
        networkBoundary: "public",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerDeploymentBinding({
        bindingId: "binding_2",
        tenantId: "tenant_123",
        environmentId: "env_2",
        deploymentMode: "cloud_shared",
        region: "us-west-2",
        networkBoundary: "public",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const bindings = service.listDeploymentBindingsForTenant("tenant_123");
    assert.equal(bindings.length, 2);
    assert.equal(bindings[0].environmentId, "env_1");
    assert.equal(bindings[1].environmentId, "env_2");
});
test("TenantBoundaryRegistryService lists tenants for user via org membership", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_123",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.addOrganizationMembership({
        userId: "user_123",
        organizationId: "org_123",
        role: "member",
        joinedAt: "2026-04-01T00:00:00.000Z",
    });
    const tenants = service.listTenantsForUser("user_123");
    assert.equal(tenants.length, 1);
    assert.equal(tenants[0].tenantId, "tenant_123");
});
test("TenantBoundaryRegistryService lists tenants with limit", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    for (let i = 0; i < 5; i++) {
        service.registerTenant({
            tenantId: `tenant_${i}`,
            organizationId: "org_123",
            storageScope: "tenant",
            identityScope: "tenant",
            policyScope: "tenant",
            artifactScope: "tenant",
            isolationMode: "shared_logical",
            deploymentMode: "cloud_shared",
            createdAt: new Date(2026, 3, i + 1).toISOString(),
            updatedAt: new Date(2026, 3, i + 1).toISOString(),
        });
    }
    const tenants = service.listTenants(3);
    assert.equal(tenants.length, 3);
    // Should be sorted by createdAt descending (newest first)
    assert.equal(tenants[0].tenantId, "tenant_4");
});
test("TenantBoundaryRegistryService throws on invalid userId format", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.registerUser({
        userId: "invalid user id!@#",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    }), (error) => error instanceof Error && "code" in error && error.code === "tenant.invalid_user_id");
});
test("TenantBoundaryRegistryService throws on empty displayName", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.registerUser({
        userId: "user_123",
        displayName: "   ",
        status: "active",
        identityProvider: "idp_1",
    }), (error) => error instanceof Error && "code" in error && error.code === "tenant.invalid_user_display_name");
});
test("TenantBoundaryRegistryService throws on invalid workspaceId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.registerWorkspace({
        workspaceId: "invalid workspace!",
        ownerId: "owner_1",
        displayName: "Test Workspace",
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: "org_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && "code" in error && error.code === "tenant.invalid_workspace_id");
});
test("TenantBoundaryRegistryService throws on invalid organizationId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.registerOrganization({
        organizationId: "invalid org!",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && "code" in error && error.code === "tenant.invalid_organization_id");
});
test("TenantBoundaryRegistryService throws on invalid tenantId", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    assert.throws(() => service.registerTenant({
        tenantId: "invalid tenant!",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && "code" in error && error.code === "tenant.invalid_tenant_id");
});
test("TenantBoundaryRegistryService requires organization before workspace with orgId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.registerWorkspace({
        workspaceId: "ws_123",
        ownerId: "owner_1",
        displayName: "Test Workspace",
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: "org_nonexistent",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && "code" in error && error.code === "tenant.organization_not_found");
});
test("TenantBoundaryRegistryService requires organization before tenant", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_nonexistent",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && "code" in error && error.code === "tenant.organization_not_found");
});
test("TenantBoundaryRegistryService requires tenant before deployment binding", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.registerDeploymentBinding({
        bindingId: "binding_1",
        tenantId: "tenant_nonexistent",
        environmentId: "env_1",
        deploymentMode: "cloud_shared",
        region: "us-east-1",
        networkBoundary: "public",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && "code" in error && error.code === "tenant.not_found");
});
test("TenantBoundaryRegistryService initializes from seed data", () => {
    const service = new TenantBoundaryRegistryService({
        users: [{ userId: "seed_user", displayName: "Seed User", status: "active", identityProvider: "seed" }],
        organizations: [{ organizationId: "seed_org", displayName: "Seed Org", billingAccountId: null, defaultTenantId: "seed_tenant", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" }],
        tenants: [{ tenantId: "seed_tenant", organizationId: "seed_org", storageScope: "tenant", identityScope: "tenant", policyScope: "tenant", artifactScope: "tenant", isolationMode: "shared_logical", deploymentMode: "cloud_shared", createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" }],
    });
    const decision = service.authorizeTenantAccess({
        userId: "seed_user",
        tenantId: "seed_tenant",
    });
    // Seed user is not an org member or workspace tenant access, so should be denied
    assert.equal(decision.decision, "deny");
});
test("TenantBoundaryRegistryService workspace membership allows tenant access", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_123",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization({
        organizationId: "org_123",
        displayName: "Test Org",
        billingAccountId: null,
        defaultTenantId: "tenant_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerTenant({
        tenantId: "tenant_123",
        organizationId: "org_123",
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.registerWorkspace({
        workspaceId: "ws_123",
        ownerId: "owner_1",
        displayName: "Test Workspace",
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: "org_123",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    service.addWorkspaceMembership({
        workspaceId: "ws_123",
        userId: "user_123",
        role: "editor",
        joinedAt: "2026-04-01T00:00:00.000Z",
    });
    const decision = service.authorizeTenantAccess({
        userId: "user_123",
        tenantId: "tenant_123",
    });
    assert.equal(decision.decision, "allow");
    assert.equal(decision.reasonCode, "tenant.member_allowed");
});
//# sourceMappingURL=tenant-boundary-registry-service.test.js.map