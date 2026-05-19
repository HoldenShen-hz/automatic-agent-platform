import assert from "node:assert/strict";
import test from "node:test";
import { TenantBoundaryRegistryService } from "../../../../../src/platform/control-plane/tenant/index.js";
function makeOrg(orgId, defaultTenantId = "tenant_1") {
    return {
        organizationId: orgId,
        displayName: `Org ${orgId}`,
        billingAccountId: null,
        defaultTenantId,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    };
}
function makeTenant(tenantId, orgId) {
    return {
        tenantId,
        organizationId: orgId,
        displayName: `Tenant ${tenantId}`,
        storageScope: "tenant",
        identityScope: "tenant",
        policyScope: "tenant",
        artifactScope: "tenant",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    };
}
function makeWorkspace(wsId, orgId) {
    return {
        workspaceId: wsId,
        ownerId: "owner_1",
        displayName: `Workspace ${wsId}`,
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: orgId,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    };
}
// ---------------------------------------------------------------------------
// assertSameTenant
// ---------------------------------------------------------------------------
test("TenantBoundaryRegistryService assertSameTenant throws on null sourceTenantId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.assertSameTenant({ sourceTenantId: null, targetTenantId: "tenant_1" }), (error) => error instanceof Error && error.message.includes("Cross-tenant access is denied"));
});
test("TenantBoundaryRegistryService assertSameTenant throws on null targetTenantId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.assertSameTenant({ sourceTenantId: "tenant_1", targetTenantId: null }), (error) => error instanceof Error && error.message.includes("Cross-tenant access is denied"));
});
test("TenantBoundaryRegistryService assertSameTenant throws on both null", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.assertSameTenant({ sourceTenantId: null, targetTenantId: null }), (error) => error instanceof Error && error.message.includes("Cross-tenant access is denied"));
});
test("TenantBoundaryRegistryService assertSameTenant throws on undefined sourceTenantId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.assertSameTenant({ sourceTenantId: undefined, targetTenantId: "tenant_1" }), (error) => error instanceof Error && error.message.includes("Cross-tenant access is denied"));
});
test("TenantBoundaryRegistryService assertSameTenant throws on undefined targetTenantId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.assertSameTenant({ sourceTenantId: "tenant_1", targetTenantId: undefined }), (error) => error instanceof Error && error.message.includes("Cross-tenant access is denied"));
});
test("TenantBoundaryRegistryService assertSameTenant uses custom reasonCode", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.assertSameTenant({
        sourceTenantId: "tenant_1",
        targetTenantId: "tenant_2",
        reasonCode: "custom.denial",
    }), (error) => error instanceof Error && error.code === "custom.denial");
});
// ---------------------------------------------------------------------------
// addOrganizationMembership
// ---------------------------------------------------------------------------
test("TenantBoundaryRegistryService adds and retrieves organization membership", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_1",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization(makeOrg("org_1", "tenant_1"));
    service.registerTenant(makeTenant("tenant_1", "org_1"));
    const membership = service.addOrganizationMembership({
        userId: "user_1",
        organizationId: "org_1",
        role: "admin",
        joinedAt: "2026-04-01T00:00:00.000Z",
    });
    assert.equal(membership.userId, "user_1");
    assert.equal(membership.organizationId, "org_1");
    assert.equal(membership.role, "admin");
});
test("TenantBoundaryRegistryService addOrganizationMembership throws for invalid userId", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization(makeOrg("org_1"));
    assert.throws(() => service.addOrganizationMembership({
        userId: "nonexistent_user",
        organizationId: "org_1",
        role: "member",
        joinedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && error.code === "tenant.user_not_found");
});
test("TenantBoundaryRegistryService addOrganizationMembership throws for invalid organizationId", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_1",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    assert.throws(() => service.addOrganizationMembership({
        userId: "user_1",
        organizationId: "nonexistent_org",
        role: "member",
        joinedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && error.code === "tenant.organization_not_found");
});
// ---------------------------------------------------------------------------
// addWorkspaceMembership
// ---------------------------------------------------------------------------
test("TenantBoundaryRegistryService addWorkspaceMembership throws for invalid userId", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization(makeOrg("org_1"));
    service.registerWorkspace(makeWorkspace("ws_1", "org_1"));
    assert.throws(() => service.addWorkspaceMembership({
        workspaceId: "ws_1",
        userId: "nonexistent_user",
        role: "editor",
        joinedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && error.code === "tenant.user_not_found");
});
test("TenantBoundaryRegistryService addWorkspaceMembership throws for invalid workspaceId", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_1",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    assert.throws(() => service.addWorkspaceMembership({
        workspaceId: "nonexistent_ws",
        userId: "user_1",
        role: "editor",
        joinedAt: "2026-04-01T00:00:00.000Z",
    }), (error) => error instanceof Error && error.code === "tenant.workspace_not_found");
});
// ---------------------------------------------------------------------------
// resolveTenantForWorkspace error cases
// ---------------------------------------------------------------------------
test("TenantBoundaryRegistryService resolveTenantForWorkspace throws for invalid workspaceId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.resolveTenantForWorkspace("nonexistent_ws"), (error) => error instanceof Error && error.code === "tenant.workspace_not_found");
});
test("TenantBoundaryRegistryService resolveTenantForWorkspace returns null for workspace without org", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerWorkspace({
        workspaceId: "ws_no_org",
        ownerId: "owner_1",
        displayName: "Workspace Without Org",
        planId: "plan_free",
        defaultPolicySet: "default",
        organizationId: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const tenant = service.resolveTenantForWorkspace("ws_no_org");
    assert.equal(tenant, null);
});
// ---------------------------------------------------------------------------
// listDeploymentBindingsForTenant error cases
// ---------------------------------------------------------------------------
test("TenantBoundaryRegistryService listDeploymentBindingsForTenant throws for invalid tenantId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.listDeploymentBindingsForTenant("nonexistent_tenant"), (error) => error instanceof Error && error.code === "tenant.not_found");
});
// ---------------------------------------------------------------------------
// listTenantsForUser via workspace tenant access (not org membership)
// ---------------------------------------------------------------------------
test("TenantBoundaryRegistryService listTenantsForUser via workspace tenant access", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_ws_tenant",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization(makeOrg("org_ws", "tenant_ws"));
    service.registerTenant(makeTenant("tenant_ws", "org_ws"));
    service.registerWorkspace(makeWorkspace("ws_user", "org_ws"));
    // User is workspace member but NOT org member
    service.addWorkspaceMembership({
        workspaceId: "ws_user",
        userId: "user_ws_tenant",
        role: "editor",
        joinedAt: "2026-04-01T00:00:00.000Z",
    });
    const tenants = service.listTenantsForUser("user_ws_tenant");
    assert.equal(tenants.length, 1);
    assert.equal(tenants[0].tenantId, "tenant_ws");
});
// ---------------------------------------------------------------------------
// listTenantsForUser error case
// ---------------------------------------------------------------------------
test("TenantBoundaryRegistryService listTenantsForUser throws for invalid userId", () => {
    const service = new TenantBoundaryRegistryService();
    assert.throws(() => service.listTenantsForUser("nonexistent_user"), (error) => error instanceof Error && error.code === "tenant.user_not_found");
});
// ---------------------------------------------------------------------------
// authorizeTenantAccess error cases
// ---------------------------------------------------------------------------
test("TenantBoundaryRegistryService authorizeTenantAccess throws for invalid userId", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerOrganization(makeOrg("org_1", "tenant_1"));
    service.registerTenant(makeTenant("tenant_1", "org_1"));
    assert.throws(() => service.authorizeTenantAccess({ userId: "invalid_user", tenantId: "tenant_1" }), (error) => error instanceof Error && error.code === "tenant.user_not_found");
});
test("TenantBoundaryRegistryService authorizeTenantAccess throws for invalid tenantId", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_1",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    assert.throws(() => service.authorizeTenantAccess({ userId: "user_1", tenantId: "invalid_tenant" }), (error) => error instanceof Error && error.code === "tenant.not_found");
});
test("TenantBoundaryRegistryService authorizeTenantAccess throws for invalid workspaceId", () => {
    const service = new TenantBoundaryRegistryService();
    service.registerUser({
        userId: "user_1",
        displayName: "Test User",
        status: "active",
        identityProvider: "idp_1",
    });
    service.registerOrganization(makeOrg("org_1", "tenant_1"));
    service.registerTenant(makeTenant("tenant_1", "org_1"));
    assert.throws(() => service.authorizeTenantAccess({ userId: "user_1", tenantId: "tenant_1", workspaceId: "invalid_ws" }), (error) => error instanceof Error && error.code === "tenant.workspace_not_found");
});
//# sourceMappingURL=tenant-boundary-registry-service.edge-cases.test.js.map