import assert from "node:assert/strict";
import test from "node:test";
import { TenantBoundaryRegistryService } from "../../../../../src/platform/control-plane/tenant/index.js";
function buildRegistry() {
    return new TenantBoundaryRegistryService({
        users: [
            { userId: "user-1", displayName: "Alice", status: "active", identityProvider: "oidc" },
            { userId: "user-2", displayName: "Bob", status: "disabled", identityProvider: "oidc" },
            { userId: "user-3", displayName: "Carol", status: "active", identityProvider: "oidc" },
        ],
        organizations: [
            {
                organizationId: "org-1",
                displayName: "Org One",
                billingAccountId: null,
                defaultTenantId: "tenant-1",
                createdAt: "2026-04-20T00:00:00.000Z",
                updatedAt: "2026-04-20T00:00:00.000Z",
            },
        ],
        workspaces: [
            {
                workspaceId: "workspace-1",
                ownerId: "user-1",
                displayName: "Workspace One",
                planId: "pro",
                defaultPolicySet: "default",
                organizationId: "org-1",
                createdAt: "2026-04-20T00:00:00.000Z",
                updatedAt: "2026-04-20T00:00:00.000Z",
            },
        ],
        tenants: [
            {
                tenantId: "tenant-1",
                organizationId: "org-1",
                storageScope: "storage-1",
                identityScope: "identity-1",
                policyScope: "policy-1",
                artifactScope: "artifact-1",
                isolationMode: "shared_hard_scoped",
                deploymentMode: "cloud_shared",
                createdAt: "2026-04-20T00:00:00.000Z",
                updatedAt: "2026-04-20T00:00:00.000Z",
            },
        ],
        workspaceMemberships: [
            {
                workspaceId: "workspace-1",
                userId: "user-1",
                role: "editor",
                joinedAt: "2026-04-20T00:00:00.000Z",
            },
        ],
    });
}
test("TenantBoundaryRegistryService allows access for workspace membership within the tenant organization", () => {
    const service = buildRegistry();
    const decision = service.authorizeTenantAccess({
        userId: "user-1",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
    });
    assert.equal(decision.decision, "allow");
    assert.equal(service.resolveTenantForWorkspace("workspace-1")?.tenantId, "tenant-1");
});
test("TenantBoundaryRegistryService defaults to deny but can surface governance exceptions", () => {
    const service = buildRegistry();
    const denied = service.authorizeTenantAccess({
        userId: "user-3",
        tenantId: "tenant-1",
    });
    const override = service.authorizeTenantAccess({
        userId: "user-3",
        tenantId: "tenant-1",
        governanceRef: "approval-1",
    });
    assert.equal(denied.decision, "deny");
    assert.equal(override.decision, "allow_with_governance_exception");
});
test("TenantBoundaryRegistryService blocks explicit cross-tenant assertions", () => {
    const service = buildRegistry();
    assert.throws(() => {
        service.assertSameTenant({
            sourceTenantId: "tenant-1",
            targetTenantId: "tenant-2",
        });
    }, (error) => error instanceof Error && "code" in error && error.code === "tenant.cross_tenant_denied");
});
//# sourceMappingURL=index.test.js.map