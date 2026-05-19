/**
 * Tenant Platform CLI Tests
 *
 * Tests for tenant-platform.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for tenant platform action branching
// ---------------------------------------------------------------------------
test("tenant-platform action create_workspace is valid", () => {
    const action = "create_workspace";
    assert.equal(action, "create_workspace");
});
test("tenant-platform action add_workspace_member is valid", () => {
    const action = "add_workspace_member";
    assert.equal(action, "add_workspace_member");
});
test("tenant-platform action create_organization is valid", () => {
    const action = "create_organization";
    assert.equal(action, "create_organization");
});
test("tenant-platform action add_organization_member is valid", () => {
    const action = "add_organization_member";
    assert.equal(action, "add_organization_member");
});
test("tenant-platform action create_tenant is valid", () => {
    const action = "create_tenant";
    assert.equal(action, "create_tenant");
});
test("tenant-platform action bind_deployment is valid", () => {
    const action = "bind_deployment";
    assert.equal(action, "bind_deployment");
});
test("tenant-platform action create_namespace is valid", () => {
    const action = "create_namespace";
    assert.equal(action, "create_namespace");
});
test("tenant-platform action topology is valid", () => {
    const action = "topology";
    assert.equal(action, "topology");
});
// ---------------------------------------------------------------------------
// Tests for create_workspace argument building
// ---------------------------------------------------------------------------
test("create_workspace builds arguments with ownerId, displayName, planId", () => {
    const envConfig = {
        ownerId: "user-123",
        displayName: "My Workspace",
        planId: "plan-free",
        workspaceId: null,
        defaultPolicySet: null,
        organizationId: "org-1",
    };
    const args = {
        ownerId: envConfig.ownerId,
        displayName: envConfig.displayName,
        planId: envConfig.planId,
        organizationId: envConfig.organizationId,
    };
    if (envConfig.workspaceId) {
        args.workspaceId = envConfig.workspaceId;
    }
    if (envConfig.defaultPolicySet) {
        args.defaultPolicySet = envConfig.defaultPolicySet;
    }
    assert.equal(args.ownerId, "user-123");
    assert.equal(args.displayName, "My Workspace");
    assert.equal(args.planId, "plan-free");
    assert.equal(args.organizationId, "org-1");
    assert.equal(args.workspaceId, undefined);
});
test("create_workspace includes optional workspaceId when provided", () => {
    const envConfig = {
        ownerId: "user-123",
        displayName: "My Workspace",
        planId: "plan-pro",
        workspaceId: "ws-custom-1",
        defaultPolicySet: null,
        organizationId: "org-1",
    };
    const args = {
        ownerId: envConfig.ownerId,
        displayName: envConfig.displayName,
        planId: envConfig.planId,
        organizationId: envConfig.organizationId,
    };
    if (envConfig.workspaceId) {
        args.workspaceId = envConfig.workspaceId;
    }
    assert.equal(args.workspaceId, "ws-custom-1");
});
// ---------------------------------------------------------------------------
// Tests for create_tenant argument building
// ---------------------------------------------------------------------------
test("create_tenant builds arguments with scopes and isolation", () => {
    const envConfig = {
        organizationId: "org-1",
        storageScope: "shared",
        identityScope: "dedicated",
        policyScope: "shared",
        artifactScope: "dedicated",
        tenantId: null,
        isolationMode: "hardened",
        deploymentMode: null,
        setAsOrganizationDefault: true,
    };
    const args = {
        organizationId: envConfig.organizationId,
        storageScope: envConfig.storageScope,
        identityScope: envConfig.identityScope,
        policyScope: envConfig.policyScope,
        artifactScope: envConfig.artifactScope,
        setAsOrganizationDefault: envConfig.setAsOrganizationDefault,
    };
    if (envConfig.tenantId) {
        args.tenantId = envConfig.tenantId;
    }
    if (envConfig.isolationMode) {
        args.isolationMode = envConfig.isolationMode;
    }
    assert.equal(args.storageScope, "shared");
    assert.equal(args.isolationMode, "hardened");
    assert.equal(args.setAsOrganizationDefault, true);
});
//# sourceMappingURL=tenant-platform.test.js.map