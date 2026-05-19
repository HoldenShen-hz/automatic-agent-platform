import assert from "node:assert/strict";
import test from "node:test";
import { DataPlaneFlowServiceAsync } from "../../src/scale-ecosystem/tenant-platform/data-plane-flow-service-async.js";
import { TenantPlatformServiceAsync } from "../../src/scale-ecosystem/tenant-platform/tenant-platform-service-async.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
test("E2E: tenant-platform blocks cross-tenant data movement between isolated namespaces", async () => {
    const harness = createE2EHarness("aa-e2e-tenant-boundary-");
    try {
        const tenantPlatform = new TenantPlatformServiceAsync(harness.db, harness.store);
        const dataPlane = new DataPlaneFlowServiceAsync(harness.db, harness.store);
        const organization = await tenantPlatform.createOrganizationAsync({
            organizationId: "org-boundary",
            displayName: "Boundary Org",
        });
        const tenantA = await tenantPlatform.createTenantAsync({
            tenantId: "tenant-boundary-a",
            organizationId: organization.organizationId,
            storageScope: "storage-a",
            identityScope: "identity-a",
            policyScope: "policy-a",
            artifactScope: "artifact-a",
            setAsOrganizationDefault: true,
        });
        const tenantB = await tenantPlatform.createTenantAsync({
            tenantId: "tenant-boundary-b",
            organizationId: organization.organizationId,
            storageScope: "storage-b",
            identityScope: "identity-b",
            policyScope: "policy-b",
            artifactScope: "artifact-b",
        });
        const sourceNamespace = await tenantPlatform.createDataNamespaceAsync({
            namespaceId: "ns-boundary-source",
            plane: "transactional",
            tenantId: tenantA.tenantId,
            organizationId: organization.organizationId,
            retentionPolicy: "retain_30d",
            encryptionPolicy: "enc_standard",
        });
        const targetNamespace = await tenantPlatform.createDataNamespaceAsync({
            namespaceId: "ns-boundary-target",
            plane: "analytics",
            tenantId: tenantB.tenantId,
            organizationId: organization.organizationId,
            retentionPolicy: "retain_30d",
            encryptionPolicy: "enc_standard",
        });
        let boundaryError = null;
        try {
            dataPlane.getSyncService().startMovementJob({
                jobId: "move-cross-tenant",
                sourceNamespaceId: sourceNamespace.namespaceId,
                targetNamespaceId: targetNamespace.namespaceId,
                movementType: "analytics_etl",
                inputRefs: ["artifact://boundary/batch-1"],
            });
        }
        catch (error) {
            boundaryError = error;
        }
        assert.equal(boundaryError?.name, "TenantBoundaryError");
        assert.equal(boundaryError?.code, "data_plane.cross_tenant_movement_denied");
        const summaryA = await dataPlane.buildSummaryAsync({ tenantId: tenantA.tenantId });
        const summaryB = await dataPlane.buildSummaryAsync({ tenantId: tenantB.tenantId });
        assert.equal(summaryA.totals.movementJobs, 0);
        assert.equal(summaryB.totals.movementJobs, 0);
        assert.equal(summaryA.namespacesByPlane.transactional, 1);
        assert.equal(summaryB.namespacesByPlane.analytics, 1);
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=tenant-boundary-flow.test.js.map