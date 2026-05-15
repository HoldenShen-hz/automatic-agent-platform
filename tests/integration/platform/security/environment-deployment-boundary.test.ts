import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { EnvironmentDeploymentService } from "../../../../src/platform/five-plane-control-plane/incident-control/environment-deployment-service.js";
import { SecretManagementService } from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const REPO_ROOT = process.cwd();

test("environment deployment export reports prod as blocked when promotion prerequisites are not ready", async () => {
  const workspace = createTempWorkspace("aa-environment-deployment-boundary-");
  const dbPath = join(workspace, "environment-deployment-boundary.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    const store = new AuthoritativeTaskStore(db);
    const service = new EnvironmentDeploymentService(store, {
      repoRootDir: REPO_ROOT,
      secretManagementService: new SecretManagementService(db, store),
      artifactStoreOptions: {
        rootDir: join(workspace, "artifacts"),
      },
    });

    const exported = await service.exportReport({
      targetEnvironment: "prod",
      version: "6.7.8",
      commitSha: "abcdef1234567890",
      rolloutStrategy: "blue_green",
      taskId: "environment_deployment_boundary",
    });

    assert.equal(exported.report.targetEnvironment, "prod");
    assert.equal(exported.report.targetEligible, false);
    assert.equal(exported.report.targetReleaseBundle, null);
    const prodEntry = exported.report.entries.find((entry) => entry.environment === "prod");
    assert.ok(prodEntry);
    assert.equal(prodEntry.deployReady, false);
    assert.ok(prodEntry.blockers.some((item) => item.startsWith("promotion_prerequisite_not_ready:")));
    assert.match(exported.jsonArtifact.uri, /environment-deployment-prod\.json$/);
    assert.match(exported.markdownArtifact.uri, /environment-deployment-prod\.md$/);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
