import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ComplianceProgramService } from "../../../../src/scale-ecosystem/marketplace/compliance-program-service.js";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("ComplianceProgramService summarizes namespace residency and audit export readiness", () => {
  const workspace = createTempWorkspace("aa-compliance-program-");
  const dbPath = join(workspace, "compliance-program.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  try {
    const store = new AuthoritativeTaskStore(db);
    const tenantPlatform = new TenantPlatformService(db, store);
    tenantPlatform.createOrganization({
      organizationId: "org-compliance",
      displayName: "Compliance Org",
      billingAccountId: null,
      defaultTenantId: null,
    });
    tenantPlatform.createWorkspace({
      workspaceId: "ws-compliance",
      displayName: "Compliance Workspace",
      ownerId: "owner-compliance",
      planId: "enterprise",
      defaultPolicySet: "strict",
      organizationId: "org-compliance",
    });
    tenantPlatform.createTenant({
      tenantId: "tenant-compliance",
      organizationId: "org-compliance",
      storageScope: "tenant-compliance",
      identityScope: "tenant-compliance",
      policyScope: "tenant-compliance",
      artifactScope: "tenant-compliance",
      isolationMode: "shared_hard_scoped",
      deploymentMode: "private_cloud",
    });
    tenantPlatform.createDeploymentBinding({
      bindingId: "binding-compliance",
      tenantId: "tenant-compliance",
      environmentId: "prod-cn",
      region: "cn-mainland",
      networkBoundary: "private",
      deploymentMode: "private_cloud",
    });
    tenantPlatform.createDataNamespace({
      namespaceId: "namespace-compliance",
      plane: "transactional",
      tenantId: "tenant-compliance",
      organizationId: "org-compliance",
      workspaceId: "ws-compliance",
      retentionPolicy: "default",
      encryptionPolicy: "aes256",
      residencyPolicy: "cn-mainland",
    });

    const service = new ComplianceProgramService(store);
    const report = service.buildReport();

    assert.equal(report.tenantCount, 1);
    assert.ok(report.auditExportReady);
    assert.ok(report.residencySummary.some((entry) => entry.residencyPolicy === "cn-mainland"));
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("ComplianceProgramService reports zero tenants when store is empty", () => {
  const workspace = createTempWorkspace("aa-compliance-empty-");
  const dbPath = join(workspace, "compliance-empty.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  try {
    const store = new AuthoritativeTaskStore(db);
    const service = new ComplianceProgramService(store);
    const report = service.buildReport();

    assert.equal(report.tenantCount, 0);
    assert.equal(report.residencySummary.length, 0);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
