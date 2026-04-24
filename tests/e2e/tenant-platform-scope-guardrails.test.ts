import assert from "node:assert/strict";
import test from "node:test";

import { DataPlaneFlowServiceAsync } from "../../src/scale-ecosystem/tenant-platform/data-plane-flow-service-async.js";
import { TenantPlatformServiceAsync } from "../../src/scale-ecosystem/tenant-platform/tenant-platform-service-async.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";

test("E2E: tenant-platform rejects namespace creation when workspace and tenant belong to different organizations", async () => {
  const harness = createE2EHarness("aa-e2e-tenant-scope-");

  try {
    const tenantPlatform = new TenantPlatformServiceAsync(harness.db, harness.store);

    const organizationA = await tenantPlatform.createOrganizationAsync({
      organizationId: "org-scope-a",
      displayName: "Scope Org A",
    });
    const organizationB = await tenantPlatform.createOrganizationAsync({
      organizationId: "org-scope-b",
      displayName: "Scope Org B",
    });
    const workspaceA = await tenantPlatform.createWorkspaceAsync({
      workspaceId: "workspace-scope-a",
      ownerId: "user-scope-a",
      displayName: "Workspace A",
      planId: "plan_pro",
      organizationId: organizationA.organizationId,
    });
    const tenantB = await tenantPlatform.createTenantAsync({
      tenantId: "tenant-scope-b",
      organizationId: organizationB.organizationId,
      storageScope: "storage-scope-b",
      identityScope: "identity-scope-b",
      policyScope: "policy-scope-b",
      artifactScope: "artifact-scope-b",
      setAsOrganizationDefault: true,
    });

    let mismatchError: unknown = null;
    try {
      await tenantPlatform.createDataNamespaceAsync({
        namespaceId: "ns-scope-mismatch",
        plane: "analytics",
        tenantId: tenantB.tenantId,
        workspaceId: workspaceA.workspaceId,
        retentionPolicy: "retain_30d",
        encryptionPolicy: "enc_standard",
      });
    } catch (error) {
      mismatchError = error;
    }

    assert.equal((mismatchError as { name?: string } | null)?.name, "TenantBoundaryError");
    assert.equal((mismatchError as { code?: string } | null)?.code, "tenant.workspace_tenant_organization_mismatch");
    assert.equal(harness.store.listDataNamespaces({ limit: 50 }).length, 0);
  } finally {
    harness.cleanup();
  }
});

test("E2E: tenant-platform blocks cross-workspace data movement even within the same tenant", async () => {
  const harness = createE2EHarness("aa-e2e-tenant-workspace-boundary-");

  try {
    const tenantPlatform = new TenantPlatformServiceAsync(harness.db, harness.store);
    const dataPlane = new DataPlaneFlowServiceAsync(harness.db, harness.store);

    const organization = await tenantPlatform.createOrganizationAsync({
      organizationId: "org-workspace-boundary",
      displayName: "Workspace Boundary Org",
    });
    const workspaceA = await tenantPlatform.createWorkspaceAsync({
      workspaceId: "workspace-boundary-a",
      ownerId: "user-boundary-a",
      displayName: "Workspace Boundary A",
      planId: "plan_pro",
      organizationId: organization.organizationId,
    });
    const workspaceB = await tenantPlatform.createWorkspaceAsync({
      workspaceId: "workspace-boundary-b",
      ownerId: "user-boundary-b",
      displayName: "Workspace Boundary B",
      planId: "plan_pro",
      organizationId: organization.organizationId,
    });
    const tenant = await tenantPlatform.createTenantAsync({
      tenantId: "tenant-workspace-boundary",
      organizationId: organization.organizationId,
      storageScope: "storage-boundary",
      identityScope: "identity-boundary",
      policyScope: "policy-boundary",
      artifactScope: "artifact-boundary",
      setAsOrganizationDefault: true,
    });
    const sourceNamespace = await tenantPlatform.createDataNamespaceAsync({
      namespaceId: "ns-workspace-source",
      plane: "transactional",
      tenantId: tenant.tenantId,
      organizationId: organization.organizationId,
      workspaceId: workspaceA.workspaceId,
      retentionPolicy: "retain_30d",
      encryptionPolicy: "enc_standard",
    });
    const targetNamespace = await tenantPlatform.createDataNamespaceAsync({
      namespaceId: "ns-workspace-target",
      plane: "analytics",
      tenantId: tenant.tenantId,
      organizationId: organization.organizationId,
      workspaceId: workspaceB.workspaceId,
      retentionPolicy: "retain_30d",
      encryptionPolicy: "enc_standard",
    });

    let boundaryError: unknown = null;
    try {
      dataPlane.getSyncService().startMovementJob({
        jobId: "move-cross-workspace",
        sourceNamespaceId: sourceNamespace.namespaceId,
        targetNamespaceId: targetNamespace.namespaceId,
        movementType: "analytics_etl",
        inputRefs: ["artifact://workspace-boundary/batch-1"],
      });
    } catch (error) {
      boundaryError = error;
    }

    const summary = await dataPlane.buildSummaryAsync({ tenantId: tenant.tenantId });

    assert.equal((boundaryError as { name?: string } | null)?.name, "TenantBoundaryError");
    assert.equal((boundaryError as { code?: string } | null)?.code, "data_plane.cross_workspace_movement_denied");
    assert.equal(summary.totals.movementJobs, 0);
    assert.equal(summary.namespacesByPlane.transactional, 1);
    assert.equal(summary.namespacesByPlane.analytics, 1);
  } finally {
    harness.cleanup();
  }
});
