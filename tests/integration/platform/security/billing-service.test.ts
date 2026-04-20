import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { BillingService } from "../../../../src/scale-ecosystem/marketplace/billing-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedBillingDataset } from "../../../helpers/billing.js";

test("billing summary export fails closed when artifact root escapes the sandbox policy", () => {
  const workspace = createTempWorkspace("aa-billing-security-");
  const dbPath = join(workspace, "billing-security.db");
  const outsideRoot = join(workspace, "..", "outside-billing-artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedBillingDataset(db, store);

    const service = new BillingService(db, store, {
      artifactStoreOptions: {
        rootDir: outsideRoot,
        sandboxPolicy: createWorkspaceWritePolicy(workspace),
      },
    });

    assert.throws(
      () => service.exportAccountSummary("acct-pro-1"),
      /sandbox\.path_outside_allowed_roots/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
