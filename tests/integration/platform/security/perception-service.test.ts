import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { PerceptionService } from "../../../../src/scale-ecosystem/marketplace/perception-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedPerceptionDataset } from "../../../helpers/perception.js";

test("perception brief export fails closed when artifact root escapes the sandbox policy", () => {
  const workspace = createTempWorkspace("aa-perception-security-");
  const dbPath = join(workspace, "perception-security.db");
  const outsideRoot = join(workspace, "..", "outside-perception-artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const seeded = seedPerceptionDataset(db, store);
    const service = new PerceptionService(db, store, {
      artifactStoreOptions: {
        rootDir: outsideRoot,
        sandboxPolicy: createWorkspaceWritePolicy(workspace),
      },
    });

    assert.throws(
      () => service.exportBrief(seeded.briefId),
      /sandbox\.path_outside_allowed_roots/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
