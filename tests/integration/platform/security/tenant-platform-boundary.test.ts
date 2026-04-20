import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { TenantPlatformService } from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "tenant-platform-security.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new TenantPlatformService(db, store);
  return { workspace, db, store, service };
}

test("tenant platform service fail-closes deployment bindings for unknown tenants", () => {
  const harness = createHarness("aa-tenant-platform-security-");
  try {
    assert.throws(
      () =>
        harness.service.createDeploymentBinding({
          bindingId: "binding-missing",
          tenantId: "tenant-missing",
          environmentId: "prod",
          deploymentMode: "private_cloud",
          region: "cn-shanghai-1",
          networkBoundary: "private-vpc",
        }),
      /tenant\.not_found:tenant-missing/,
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("tenant platform service fail-closes namespaces without any tenant, organization, or workspace scope", () => {
  const harness = createHarness("aa-tenant-platform-security-");
  try {
    assert.throws(
      () =>
        harness.service.createDataNamespace({
          namespaceId: "ns-invalid",
          plane: "analytics",
          retentionPolicy: "default_30d",
          encryptionPolicy: "platform_default",
        }),
      /tenant\.namespace_scope_required/,
    );
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
