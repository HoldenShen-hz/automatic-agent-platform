import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { PmfValidationService } from "../../../../src/scale-ecosystem/marketplace/pmf-validation-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { PMF_EVALUATED_AT, seedPmfValidationDataset } from "../../../helpers/pmf.js";

test("pmf validation export fails closed when artifact root escapes the sandbox policy", () => {
  const workspace = createTempWorkspace("aa-pmf-security-");
  const dbPath = join(workspace, "pmf-security.db");
  const outsideRoot = join(workspace, "..", "outside-pmf-artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedPmfValidationDataset(db, store);

    const service = new PmfValidationService(db, store, {
      rootDir: outsideRoot,
      sandboxPolicy: createWorkspaceWritePolicy(workspace),
    });

    assert.throws(
      () => service.exportValidation({ evaluatedAt: PMF_EVALUATED_AT }),
      /sandbox\.path_outside_allowed_roots/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
