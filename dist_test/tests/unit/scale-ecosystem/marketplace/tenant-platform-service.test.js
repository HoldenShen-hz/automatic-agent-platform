import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function createHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "tenant-platform.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TenantPlatformService(db, store);
    return { workspace, db, store, service };
}
test("TenantPlatformService creates workspace, organization, tenant, binding, and namespace topology", () => {
    const harness = createHarness("aa-tenant-platform-unit-");
    try {
        const organization = harness.service.createOrganization({
            organizationId: "org-alpha",
            displayName: "Alpha Org",
        });
        const workspace = harness.service.createWorkspace({
            workspaceId: "ws-alpha",
            ownerId: "user-alpha",
            displayName: "Alpha Workspace",
            planId: "enterprise",
            organizationId: organization.organizationId,
        });
        harness.service.addWorkspaceMembership({
            workspaceId: workspace.workspaceId,
            userId: "user-beta",
            role: "editor",
        });
        harness.service.addOrganizationMembership({
            organizationId: organization.organizationId,
            userId: "user-alpha",
            role: "admin",
        });
        const tenant = harness.service.createTenant({
            tenantId: "tenant-alpha",
            organizationId: organization.organizationId,
            storageScope: "tenant-alpha.storage",
            identityScope: "tenant-alpha.identity",
            policyScope: "tenant-alpha.policy",
            artifactScope: "tenant-alpha.artifact",
            deploymentMode: "private_cloud",
            setAsOrganizationDefault: true,
        });
        const binding = harness.service.createDeploymentBinding({
            bindingId: "binding-alpha",
            tenantId: tenant.tenantId,
            environmentId: "prod-private",
            deploymentMode: "private_cloud",
            region: "cn-shanghai-1",
            networkBoundary: "private-vpc",
        });
        const namespace = harness.service.createDataNamespace({
            namespaceId: "ns-alpha-artifact",
            plane: "artifact",
            workspaceId: workspace.workspaceId,
            tenantId: tenant.tenantId,
            retentionPolicy: "tenant_365d",
            encryptionPolicy: "kms:tenant-alpha",
            residencyPolicy: "cn-mainland",
        });
        assert.equal(namespace.organizationId, organization.organizationId);
        assert.equal(binding.tenantId, tenant.tenantId);
        const summary = harness.service.buildTopologySummary();
        assert.equal(summary.counts.organizations, 1);
        assert.equal(summary.counts.workspaces, 1);
        assert.equal(summary.counts.tenants, 1);
        assert.equal(summary.counts.deploymentBindings, 1);
        assert.equal(summary.counts.dataNamespaces, 1);
        assert.equal(summary.workspaces[0]?.memberships.length, 2);
        assert.equal(summary.organizations[0]?.memberships.length, 1);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("TenantPlatformService rejects namespace when workspace and tenant belong to different organizations", () => {
    const harness = createHarness("aa-tenant-platform-unit-");
    try {
        const orgA = harness.service.createOrganization({
            organizationId: "org-a",
            displayName: "Org A",
        });
        const orgB = harness.service.createOrganization({
            organizationId: "org-b",
            displayName: "Org B",
        });
        harness.service.createWorkspace({
            workspaceId: "ws-a",
            ownerId: "user-a",
            displayName: "Workspace A",
            planId: "pro",
            organizationId: orgA.organizationId,
        });
        harness.service.createTenant({
            tenantId: "tenant-b",
            organizationId: orgB.organizationId,
            storageScope: "tenant-b.storage",
            identityScope: "tenant-b.identity",
            policyScope: "tenant-b.policy",
            artifactScope: "tenant-b.artifact",
        });
        assert.throws(() => harness.service.createDataNamespace({
            namespaceId: "ns-cross",
            plane: "transactional",
            workspaceId: "ws-a",
            tenantId: "tenant-b",
            retentionPolicy: "default_90d",
            encryptionPolicy: "platform_default",
        }), /tenant\.workspace_tenant_organization_mismatch/);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("TenantPlatformService rejects invalid workspace identifier", () => {
    const harness = createHarness("aa-tenant-platform-");
    try {
        assert.throws(() => harness.service.createWorkspace({
            workspaceId: "invalid workspace!",
            ownerId: "user-1",
            displayName: "Test",
            planId: "pro",
        }), /tenant\.invalid_workspace_id/);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("TenantPlatformService creates workspace without organization", () => {
    const harness = createHarness("aa-tenant-platform-");
    try {
        const workspace = harness.service.createWorkspace({
            workspaceId: "ws-standalone",
            ownerId: "user-owner",
            displayName: "Standalone Workspace",
            planId: "pro",
        });
        assert.equal(workspace.workspaceId, "ws-standalone");
        assert.equal(workspace.organizationId, null);
        const summary = harness.service.buildTopologySummary();
        assert.equal(summary.counts.workspaces, 1);
        assert.equal(summary.workspaces[0]?.memberships.length, 1);
        assert.equal(summary.workspaces[0]?.memberships[0]?.role, "owner");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("TenantPlatformService creates multiple tenants in same organization", () => {
    const harness = createHarness("aa-tenant-platform-");
    try {
        const org = harness.service.createOrganization({
            organizationId: "org-multi",
            displayName: "Multi Tenant Org",
        });
        harness.service.createTenant({
            tenantId: "tenant-1",
            organizationId: org.organizationId,
            storageScope: "tenant1.storage",
            identityScope: "tenant1.identity",
            policyScope: "tenant1.policy",
            artifactScope: "tenant1.artifact",
        });
        harness.service.createTenant({
            tenantId: "tenant-2",
            organizationId: org.organizationId,
            storageScope: "tenant2.storage",
            identityScope: "tenant2.identity",
            policyScope: "tenant2.policy",
            artifactScope: "tenant2.artifact",
        });
        const summary = harness.service.buildTopologySummary();
        assert.equal(summary.counts.tenants, 2);
        assert.equal(summary.tenants[0]?.organizationId, org.organizationId);
        assert.equal(summary.tenants[1]?.organizationId, org.organizationId);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("TenantPlatformService enforces tenant-organization consistency for namespace", () => {
    const harness = createHarness("aa-tenant-platform-");
    try {
        const orgA = harness.service.createOrganization({
            organizationId: "org-a",
            displayName: "Org A",
        });
        const orgB = harness.service.createOrganization({
            organizationId: "org-b",
            displayName: "Org B",
        });
        harness.service.createTenant({
            tenantId: "tenant-b",
            organizationId: orgB.organizationId,
            storageScope: "tenant-b.storage",
            identityScope: "tenant-b.identity",
            policyScope: "tenant-b.policy",
            artifactScope: "tenant-b.artifact",
        });
        // Try to create namespace with tenant from orgB but explicit orgA
        assert.throws(() => harness.service.createDataNamespace({
            namespaceId: "ns-mismatch",
            plane: "artifact",
            tenantId: "tenant-b",
            organizationId: orgA.organizationId,
            retentionPolicy: "default_90d",
            encryptionPolicy: "platform_default",
        }), /tenant\.namespace_organization_mismatch/);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("TenantPlatformService requires at least one scope for namespace", () => {
    const harness = createHarness("aa-tenant-platform-");
    try {
        assert.throws(() => harness.service.createDataNamespace({
            namespaceId: "ns-scope-less",
            plane: "transactional",
            retentionPolicy: "default_90d",
            encryptionPolicy: "platform_default",
        }), /tenant\.namespace_scope_required/);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
//# sourceMappingURL=tenant-platform-service.test.js.map